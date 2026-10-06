import os
import logging
from pathlib import Path
from dotenv import load_dotenv
import litellm
from litellm import completion

logger = logging.getLogger("BugMind")

# Ensure .env is loaded from the workspace root regardless of working directory.
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

# Register LangSmith callbacks if enabled in environment
if os.getenv("LANGCHAIN_TRACING_V2", "").lower() == "true" and os.getenv("LANGCHAIN_API_KEY"):
    current_success = getattr(litellm, "success_callback", []) or []
    current_failure = getattr(litellm, "failure_callback", []) or []
    if "langsmith" not in current_success:
        litellm.success_callback = list(current_success) + ["langsmith"]
    if "langsmith" not in current_failure:
        litellm.failure_callback = list(current_failure) + ["langsmith"]
    logger.info("LangSmith tracing enabled for LiteLLM completions.")

# Provider → environment variable name mapping.
# Add new providers here — no other code changes needed.
_PROVIDER_KEY_MAP = {
    "gemini":     "GEMINI_API_KEY",
    "openai":     "OPENAI_API_KEY",
    "anthropic":  "ANTHROPIC_API_KEY",
    "groq":       "GROQ_API_KEY",
    "deepseek":   "DEEPSEEK_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "together":   "TOGETHERAI_API_KEY",
}

# Error fragments meaning the provider rejected JSON mode itself (unsupported
# response_format, or Groq's json_validate_failed when output isn't valid JSON).
_JSON_MODE_ERRORS = ("response_format", "json_validate_failed", "json mode", "json_object")

# OpenRouter's "Free Models Router" — a stable id that routes to any currently free model.
_OPENROUTER_FREE_ROUTER = "openrouter/openrouter/free"


class LiteLLMProvider:

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str | None = None,
    ):
        self.provider = provider
        self.model = model
        # api_key passed explicitly takes priority (BYOK).
        # Falls back to developer .env key automatically.
        self._explicit_api_key = api_key

    def _resolve_api_key(self) -> str | None:
        """
        Key resolution order:
        1. Explicit key passed at construction (BYOK user key).
        2. Developer key from .env for this provider.
        3. None  →  caller receives an error from LiteLLM.
        """
        if self._explicit_api_key:
            return self._explicit_api_key.strip().strip("'\"")

        env_var = _PROVIDER_KEY_MAP.get(self.provider.lower())
        if env_var:
            key = os.getenv(env_var)
            return key.strip().strip("'\"") if key else None

        return None

    @staticmethod
    def _supports_json_mode(model_name: str, provider: str) -> bool:
        try:
            params = litellm.get_supported_openai_params(model=model_name, custom_llm_provider=provider)
        except Exception:
            return False
        return bool(params) and "response_format" in params

    @staticmethod
    def _complete(**kwargs):
        """completion(), retried once without response_format if the provider rejects JSON mode."""
        try:
            return completion(**kwargs)
        except Exception as err:
            if "response_format" in kwargs and any(k in str(err).lower() for k in _JSON_MODE_ERRORS):
                logger.warning(f"Model {kwargs.get('model')} rejected JSON mode. Retrying without it...")
                kwargs.pop("response_format")
                return completion(**kwargs)
            raise

    @staticmethod
    def _build_messages(prompt: str, system: str | None, merge: bool = False) -> list[dict]:
        if not system:
            return [{"role": "user", "content": prompt}]
        if merge:
            return [{"role": "user", "content": f"{system}\n\n{prompt}"}]
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]

    def generate(self, prompt: str, system: str | None = None, json_mode: bool = False) -> str:
        api_key = self._resolve_api_key()
        messages = self._build_messages(prompt, system)

        prov = self.provider.lower().strip()
        model_name = self.model or ""
        if prov and not model_name.startswith(f"{prov}/"):
            if "/" not in model_name:
                model_name = f"{prov}/{model_name}"

        json_kwargs = (
            {"response_format": {"type": "json_object"}}
            if json_mode and self._supports_json_mode(model_name, prov)
            else {}
        )

        # The key is passed to completion() per call. Never write it to os.environ:
        # that is process-global, so a user's BYOK key would become the fallback
        # key for every other user served by this worker.
        env_var = _PROVIDER_KEY_MAP.get(prov)

        logger.debug(
            f"LiteLLM Provider={prov} | Model={model_name} | "
            f"KeyEnv={env_var or 'unknown'} | "
            f"KeySet={api_key is not None}"
        )

        if not api_key:
            raise ValueError(
                f"No API key found for provider '{self.provider}'. "
                f"Please provide an API key or configure {env_var or '<PROVIDER>_API_KEY'}."
            )

        try:
            extra_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "HTTP-Referer": "https://bugmind.ai",
                "X-Title": "BugMind AI",
            }
            response = self._complete(
                model=model_name,
                api_key=api_key,
                **json_kwargs,
                messages=messages,
                extra_headers=extra_headers,
            )
        except Exception as err:
            err_str = str(err).lower()
            if system and any(k in err_str for k in ["system role", "system message", "developer instruction", "system_instruction", "system prompt is not supported"]):
                # Some models (e.g. Gemma) reject system messages; keep the policy as a prefix of the user turn.
                logger.warning(f"Model {model_name} rejected the system role. Retrying with a merged prompt...")
                response = self._complete(
                    model=model_name,
                    api_key=api_key,
                    **json_kwargs,
                    messages=self._build_messages(prompt, system, merge=True),
                    extra_headers=extra_headers,
                )
            elif prov == "gemini" and model_name != "gemini/gemini-1.5-flash" and any(k in err_str for k in ["not found", "404", "does not exist", "unsupported"]):
                logger.warning(f"Model {model_name} failed with '{err}'. Falling back to gemini/gemini-1.5-flash...")
                response = self._complete(
                    model="gemini/gemini-1.5-flash",
                    api_key=api_key,
                    **json_kwargs,
                    messages=messages,
                )
            elif prov == "groq" and model_name != "groq/llama-3.3-70b-versatile" and any(k in err_str for k in ["not found", "404", "does not exist"]):
                logger.warning(f"Model {model_name} failed with '{err}'. Falling back to groq/llama-3.3-70b-versatile...")
                response = self._complete(
                    model="groq/llama-3.3-70b-versatile",
                    api_key=api_key,
                    **json_kwargs,
                    messages=messages,
                )
            elif prov == "openrouter" and model_name != _OPENROUTER_FREE_ROUTER and model_name.endswith(":free") and any(k in err_str for k in ["not found", "404", "does not exist", "no endpoints"]):
                # OpenRouter retires :free models often; the free router always picks an available one.
                logger.warning(f"Model {model_name} failed with '{err}'. Falling back to {_OPENROUTER_FREE_ROUTER}...")
                response = self._complete(
                    model=_OPENROUTER_FREE_ROUTER,
                    api_key=api_key,
                    **json_kwargs,
                    messages=messages,
                    extra_headers=extra_headers,
                )
            else:
                raise err

        return response.choices[0].message.content