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

    def generate(self, prompt: str) -> str:
        api_key = self._resolve_api_key()

        prov = self.provider.lower().strip()
        model_name = self.model or ""
        if prov and not model_name.startswith(f"{prov}/"):
            if "/" not in model_name:
                model_name = f"{prov}/{model_name}"

        env_var = _PROVIDER_KEY_MAP.get(prov)
        if env_var and api_key:
            os.environ[env_var] = api_key

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
            response = completion(
                model=model_name,
                api_key=api_key,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )
        except Exception as err:
            err_str = str(err).lower()
            if prov == "gemini" and model_name != "gemini/gemini-1.5-flash" and any(k in err_str for k in ["not found", "404", "does not exist", "unsupported"]):
                logger.warning(f"Model {model_name} failed with '{err}'. Falling back to gemini/gemini-1.5-flash...")
                response = completion(
                    model="gemini/gemini-1.5-flash",
                    api_key=api_key,
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                )
            elif prov == "groq" and model_name != "groq/llama-3.3-70b-versatile" and any(k in err_str for k in ["not found", "404", "does not exist"]):
                logger.warning(f"Model {model_name} failed with '{err}'. Falling back to groq/llama-3.3-70b-versatile...")
                response = completion(
                    model="groq/llama-3.3-70b-versatile",
                    api_key=api_key,
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                )
            else:
                raise err

        return response.choices[0].message.content