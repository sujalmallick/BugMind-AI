import os
import json
import logging
import re
import time
from dotenv import load_dotenv
from google.api_core.exceptions import (
    ResourceExhausted,
    InvalidArgument,
    GoogleAPIError,
)
from services.llm_manager import LLMManager

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s",
)
from config import (
    DEFAULT_PROVIDER,
    DEFAULT_MODEL
)
logger = logging.getLogger("BugMind")
api_key = os.getenv("GEMINI_API_KEY")

llm_manager = LLMManager(
    provider=DEFAULT_PROVIDER,
    model=DEFAULT_MODEL,
    api_key=api_key
)
if not api_key:
    raise Exception("GEMINI_API_KEY not found.")

logger.info(f"Gemini Key Loaded: {api_key[:12]}...")

# Tracks how many real Gemini requests have happened in this process's lifetime.
# Not thread-safe / resets on restart — it's a dev-visibility counter, not a
# production quota tracker. Purpose: make silent multi-call behavior visible
# in the logs instead of invisible.
_call_count = 0


def call_llm(prompt: str, _retry_on_quota: bool = True, _backoff_seconds: int = 15):
    """
    Sends a single request to Gemini.

    _retry_on_quota: when True, a ResourceExhausted (429) triggers exactly ONE
        short wait-and-retry. Most free-tier 429s are RPM-type and clear within
        seconds; this gives the pipeline a chance to recover instead of failing
        the whole run on a brief burst.
    _backoff_seconds: how long to wait before that single retry.

    Internal params are prefixed with _ since callers (agents) should just call
    call_llm(prompt) - the retry-control args are for call_llm's own recursive
    use only.
    """
    global _call_count
    _call_count += 1

    logger.info(f"Sending request to Gemini (call #{_call_count})")

    try:
        response = llm_manager.generate(prompt)

        if not response:
            return None

        return response

    except ResourceExhausted:
        if _retry_on_quota:
            logger.warning(
                f"Gemini rate/quota limit hit. Waiting {_backoff_seconds}s "
                f"before one retry..."
            )
            time.sleep(_backoff_seconds)
            return call_llm(prompt, _retry_on_quota=False)

        logger.error("Gemini quota exceeded (after backoff retry).")
        return None

    except InvalidArgument as e:
        logger.error(e)
        return None

    except GoogleAPIError as e:
        logger.error(e)
        return None

    except Exception as e:
        logger.error(e)
        return None


def parse_json_response(response, prompt=None):
    if response is None:
        return {
            "success": False,
            "error": "No response returned from LLM."
        }

    if isinstance(response, dict):
        return response

    cleaned = response.strip()
    cleaned = cleaned.replace("```json", "")
    cleaned = cleaned.replace("```", "")
    cleaned = cleaned.strip()

    # Extract first JSON array/object
    match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)

    try:
        return json.loads(cleaned)
    except Exception as e:
        logger.warning(f"JSON Parse Error: {e}")

        # Single self-healing retry if JSON parsing fails and prompt is provided.
        # Routed through call_llm() (not a raw model.generate_content() call)
        # so this request is logged and shares the same quota/error handling
        # as every other call instead of silently bypassing it.
        if prompt:
            logger.info("Attempting single self-healing retry...")
            retry_prompt = f"""
Original Prompt:
{prompt}

Your previous response failed validation/parsing with the following error:
{str(e)}

Please correct the response and return ONLY valid JSON.
Do not wrap it in markdown. Do not include explanations.
"""
            retry_response = call_llm(retry_prompt)

            if retry_response:
                try:
                    retry_cleaned = retry_response.strip()
                    retry_cleaned = retry_cleaned.replace("```json", "").replace("```", "").strip()
                    retry_match = re.search(r'(\{.*\}|\[.*\])', retry_cleaned, re.DOTALL)
                    if retry_match:
                        retry_cleaned = retry_match.group(1)
                    return json.loads(retry_cleaned)
                except Exception as retry_err:
                    logger.error(f"JSON parsing retry failed: {retry_err}")

        return {
            "success": False,
            "error": "Invalid JSON returned by AI.",
            "raw_response": response,
        }