import google.generativeai as genai


class GeminiProvider:

    def __init__(self, api_key: str, model: str):
        genai.configure(api_key=api_key)

        self.model = genai.GenerativeModel(
            model_name=model
        )

    def generate(self, prompt: str):

        response = self.model.generate_content(prompt)

        if not response.text:
            return None

        return response.text