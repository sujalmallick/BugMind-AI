import os

from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

load_dotenv()

genai.configure(
    api_key=os.getenv("GEMINI_API_KEY")
)

# Create Gemini model instance
model = genai.GenerativeModel(
    "gemini-2.5-flash"
)

def call_gemini(prompt: str):

    try:

        response = model.generate_content(prompt)

        return response.text

    except ResourceExhausted:

        return """
ERROR: Gemini API quota exceeded.
Please retry later or use a different API key.
"""