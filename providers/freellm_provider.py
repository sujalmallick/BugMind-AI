class FreeLLMProvider:

    def __init__(
        self,
        api_key=None,
        model=None,
    ):
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str):
        raise NotImplementedError(
            "FreeLLM provider not implemented yet."
        )