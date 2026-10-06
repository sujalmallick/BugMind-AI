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

import guardrails
from guardrails import GuardrailViolation
from services.llm_errors import classify_llm_error

# Redact secrets/PII from every log record and LangSmith/LiteLLM trace.
guardrails.bootstrap()

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


# Backoff (seconds) before each retry of a retryable failure (rate limits),
# used when the provider doesn't say how long to wait.
RETRY_BACKOFF_SECONDS = (1, 2, 4)
# When it does say (Retry-After / "try again in 7.66s"), we wait that long, but
# within these caps so an analysis (3-4 calls) stays inside the 180s request
# timeout. A longer wait (e.g. a daily limit) fails fast with the wait in the message.
MAX_RETRY_WAIT_SECONDS = 20
MAX_TOTAL_RETRY_WAIT_SECONDS = 30


def call_llm(
    prompt: str,
    user_id: int | None = None,
    agent: str | None = None,
    json_mode: bool = False,
):
    """
    Sends a single request to the configured LLM provider.

    Returns the response text, None for an empty response, or a
    {"success": False, "error", "code"} dict the agents and graph route on.

    json_mode asks the provider for a JSON object response where supported;
    the caller must still validate the result (it is a hint, not a guarantee).
    """
    global _call_count
    waited = 0.0

    for attempt in range(len(RETRY_BACKOFF_SECONDS) + 1):
        _call_count += 1
        logger.info(f"LLM request #{_call_count} | user_id={user_id} | agent={agent} | attempt={attempt + 1}")

        try:
            if user_id:
                db = SessionLocal()
                try:
                    manager = build_llm_manager(db, user_id)
                finally:
                    db.close()
            else:
                manager = default_llm_manager

            response = manager.generate(prompt, agent=agent, json_mode=json_mode)

            if not response:
                return None

            return response

        except GuardrailViolation as e:
            logger.warning(f"LLM response blocked by guardrail '{e.guardrail}' | agent={agent}")
            return {"success": False, "error": e.user_message, "guardrail": e.guardrail}

        except Exception as e:
            err = classify_llm_error(e)

            if err.retryable and attempt < len(RETRY_BACKOFF_SECONDS):
                hinted = getattr(err, "retry_after", None)
                wait = RETRY_BACKOFF_SECONDS[attempt] if hinted is None else max(hinted, 0.25)
                if wait <= MAX_RETRY_WAIT_SECONDS and waited + wait <= MAX_TOTAL_RETRY_WAIT_SECONDS:
                    source = "backoff" if hinted is None else "provider hint"
                    logger.warning(
                        f"LLM {err.code} | agent={agent}. Waiting {wait:.2f}s ({source}) before retry {attempt + 1}..."
                    )
                    time.sleep(wait)
                    waited += wait
                    continue
                logger.warning(
                    f"LLM {err.code} | agent={agent}. Provider asks for {wait:.0f}s; over the in-request "
                    f"retry budget, failing fast."
                )

            if err.code == "unknown":
                logger.error(f"LLM call failed with unhandled exception: {err.user_message}", exc_info=True)
            else:
                logger.error(f"LLM call failed: {err.code} | agent={agent}")
            return err.to_response()


def parse_json_response(response, prompt=None, user_id=None, agent=None, json_mode=False):
    if response is None:
        return {
            "success": False,
            "error": "No response returned from LLM."
        }

    if isinstance(response, dict):
        return response

    cleaned = str(response).strip()
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
            retry_response = call_llm(retry_prompt, user_id=user_id, agent=agent, json_mode=json_mode)

            if retry_response:
                if isinstance(retry_response, dict):
                    return retry_response
                try:
                    retry_cleaned = str(retry_response).strip()
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
            "raw_response": str(response),
        }