from providers.litellm_provider import LiteLLMProvider


class LLMManager:

    def __init__(
        self,
        provider: str = "gemini",
        model: str = None,
        api_key: str | None = None,
    ):
        self.provider_instance = LiteLLMProvider(
            provider=provider,
            model=model,
            api_key=api_key,   # Pass through — LiteLLMProvider handles resolution
        )

    def generate(self, prompt: str) -> str:
        return self.provider_instance.generate(prompt)