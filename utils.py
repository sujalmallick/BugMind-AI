import os
import json
import logging
import re
import time

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s",
)

logger = logging.getLogger("BugMind")

from services.llm_manager import LLMManager
from database.session import SessionLocal
from services.llm_factory import build_llm_manager
from config import DEFAULT_PROVIDER, DEFAULT_MODEL

# Default LLM manager uses developer .env key, no user_id required.
default_llm_manager = LLMManager(
    provider=DEFAULT_PROVIDER,
    model=DEFAULT_MODEL,
)

# Tracks how many LLM requests have happened in this process lifetime.
# Dev-visibility counter only — not thread-safe, resets on restart.
_call_count = 0


def call_llm(
    prompt: str,
    user_id: int | None = None,
    _retry_count: int = 0,
):
    """
    Sends a single request to the configured LLM provider.
    """
    global _call_count
    _call_count += 1

    logger.info(f"LLM request #{_call_count} | user_id={user_id}")

    try:
        if user_id:
            db = SessionLocal()
            try:
                manager = build_llm_manager(db, user_id)
            finally:
                db.close()
        else:
            manager = default_llm_manager

        response = manager.generate(prompt)

        if not response:
            return None

        return response

    except Exception as e:
        error_str = str(e).lower()

        # Handle rate limit / quota errors
        if any(kw in error_str for kw in ["rate limit", "quota", "429", "resource exhausted", "too many requests"]):
            if _retry_count < 3:
                backoff = [1, 2, 4][_retry_count]
                logger.warning(
                    f"Rate/quota limit hit. Waiting {backoff}s before retry {_retry_count + 1}..."
                )
                time.sleep(backoff)
                return call_llm(
                    prompt,
                    user_id=user_id,
                    _retry_count=_retry_count + 1,
                )
            logger.error("Quota exceeded (after backoff retries).")
            return {"success": False, "error": "AI Quota exceeded. Please try again later."}

        # Authentication errors
        if any(kw in error_str for kw in ["401", "403", "unauthorized", "forbidden", "api key", "invalid key"]):
            logger.error("Invalid or missing API Key.")
            return {"success": False, "error": "Invalid or missing API Key."}

        # Model / Provider errors
        if any(kw in error_str for kw in ["not found", "model", "404", "does not exist"]):
            logger.error("Model not found or unavailable.")
            return {"success": False, "error": "The selected AI model is unavailable or incorrect."}

        if any(kw in error_str for kw in ["502", "503", "504", "timeout", "connection", "offline"]):
            logger.error("AI Provider offline or timed out.")
            return {"success": False, "error": "AI Provider is currently offline or timed out. Please try again."}

        logger.error(f"LLM call failed: {e}")
        return {"success": False, "error": f"LLM call failed: {e}"}


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

        # Single self-healing retry — routed through call_llm() so it
        # shares the same quota/error handling as every other request.
        if prompt:
            logger.info("Attempting single self-healing retry...")
            retry_prompt = f"""
Original Prompt:
{prompt}

Your previous response failed JSON parsing with this error:
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
                    logger.error(f"JSON self-healing retry failed: {retry_err}")

        return {
            "success": False,
            "error": "Invalid JSON returned by AI.",
            "raw_response": response,
        }