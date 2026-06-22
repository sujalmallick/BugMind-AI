import os
import json
import logging

from dotenv import load_dotenv

import google.generativeai as genai

from google.api_core.exceptions import (
    ResourceExhausted,
    InvalidArgument,
    GoogleAPIError,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s",
)

logger = logging.getLogger("BugMind")

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise Exception("GEMINI_API_KEY not found.")

logger.info(f"Gemini Key Loaded: {api_key[:12]}...")

genai.configure(api_key=api_key)

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash"
)


def call_llm(prompt: str):
    logger.info("Sending request to Gemini...")

    try:
        response = model.generate_content(prompt)

        text = response.text

        print("\n" + "=" * 100)
        print("RAW GEMINI RESPONSE")
        print("=" * 100)
        print(text)
        print("=" * 100 + "\n")

        return text

    except ResourceExhausted:
        logger.exception("Gemini quota exceeded.")

        return {
            "success": False,
            "error": "Gemini API quota exceeded.",
        }

    except InvalidArgument as e:
        logger.exception("Invalid Gemini request.")

        return {
            "success": False,
            "error": str(e),
        }

    except GoogleAPIError as e:
        logger.exception("Google API Error.")

        return {
            "success": False,
            "error": str(e),
        }

    except Exception as e:
        logger.exception("Unexpected Gemini Error.")

        return {
            "success": False,
            "error": str(e),
        }


def parse_json_response(response):

    if response is None:
        return {
            "success": False,
            "error": "Gemini returned nothing.",
        }

    if isinstance(response, dict):
        return response

    cleaned = (
        response.replace("```json", "")
        .replace("```", "")
        .strip()
    )

    print("\n" + "=" * 100)
    print("CLEANED RESPONSE")
    print("=" * 100)
    print(cleaned)
    print("=" * 100 + "\n")

    try:
        return json.loads(cleaned)

    except json.JSONDecodeError as e:

        logger.exception("JSON Parsing Failed")

        print("\n")
        print("=" * 100)
        print("JSON ERROR")
        print(e)
        print("=" * 100)
        print("\n")

        return {
            "success": False,
            "error": f"JSON Parse Error: {str(e)}",
            "raw_response": cleaned,
        }