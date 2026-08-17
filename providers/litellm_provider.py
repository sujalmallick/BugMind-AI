import os
from pathlib import Path
from dotenv import load_dotenv
from litellm import completion

# Ensure .env is loaded from the workspace root regardless of working directory.
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

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
            return self._explicit_api_key

        env_var = _PROVIDER_KEY_MAP.get(self.provider.lower())
        if env_var:
            key = os.getenv(env_var)
            return key if key else None

        return None

    def generate(self, prompt: str) -> str:
        api_key = self._resolve_api_key()

        logger.debug(
            f"LiteLLM Provider={self.provider} | Model={self.model} | "
            f"KeyEnv={_PROVIDER_KEY_MAP.get(self.provider.lower(), 'unknown')} | "
            f"KeySet={api_key is not None}"
        )

        if not api_key:
            raise ValueError(
                f"No API key found for provider '{self.provider}'. "
                f"Set {_PROVIDER_KEY_MAP.get(self.provider.lower(), '<PROVIDER>_API_KEY')} "
                f"in your .env file."
            )

        response = completion(
            model=self.model,
            api_key=api_key,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        )

        return response.choices[0].message.content