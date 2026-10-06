"""
guardrails/tracing.py — sanitize payloads before they reach LangSmith.

Two tracing paths exist in BugMind and both are covered:

  1. LangSmith SDK (LangGraph runs, @traceable agents): the shared client gets
     hide_inputs / hide_outputs hooks that mask secrets and PII.
  2. LiteLLM's native "langsmith" callback: a CustomLogger.logging_hook
     sanitizes messages and responses before any LiteLLM success callback
     sees them. It returns copies, so the caller's response is untouched.
"""

import copy
import logging
import os

from guardrails.config import get_settings
from guardrails.detection import PII, SECRET

logger = logging.getLogger("BugMind")

_installed = {"langsmith": False, "litellm": False}


def sanitize_trace_payload(payload):
    from guardrails.data_masker import masker

    try:
        sanitized, _ = masker.mask_obj(payload, kinds=(SECRET, PII), stage="trace")
        return sanitized
    except Exception:
        return {"redacted": "trace payload withheld"}


def _tracing_enabled() -> bool:
    flags = (os.getenv("LANGCHAIN_TRACING_V2", ""), os.getenv("LANGSMITH_TRACING", ""))
    return any(f.strip().lower() == "true" for f in flags)


def install_langsmith_hooks(force: bool = False) -> bool:
    if _installed["langsmith"] or not (force or _tracing_enabled()):
        return False
    try:
        from langsmith import run_trees
    except ImportError:
        return False
    existing = getattr(run_trees, "_CLIENT", None)
    if existing is not None:
        existing._hide_inputs = sanitize_trace_payload
        existing._hide_outputs = sanitize_trace_payload
    else:
        run_trees.get_cached_client(hide_inputs=sanitize_trace_payload, hide_outputs=sanitize_trace_payload)
    _installed["langsmith"] = True
    return True


def _sanitize_model_response(result):
    try:
        clone = copy.deepcopy(result)
        for choice in getattr(clone, "choices", None) or []:
            message = getattr(choice, "message", None)
            content = getattr(message, "content", None)
            if isinstance(content, str):
                message.content = sanitize_trace_payload(content)
        return clone
    except Exception:
        return {"redacted": "trace payload withheld"}


def _sanitize_call_details(kwargs: dict) -> dict:
    details = dict(kwargs)
    for key in ("messages", "input", "prompt", "original_response", "additional_args"):
        if key in details:
            details[key] = sanitize_trace_payload(details[key])
    slo = details.get("standard_logging_object")
    if isinstance(slo, dict):
        slo = dict(slo)
        for key in ("messages", "response", "error_str", "error_information"):
            if key in slo:
                slo[key] = sanitize_trace_payload(slo[key])
        details["standard_logging_object"] = slo
    return details


def _build_litellm_redactor():
    from litellm.integrations.custom_logger import CustomLogger

    class LiteLLMTraceRedactor(CustomLogger):
        def logging_hook(self, kwargs, result, call_type):
            return _sanitize_call_details(kwargs), _sanitize_model_response(result)

        async def async_logging_hook(self, kwargs, result, call_type):
            return _sanitize_call_details(kwargs), _sanitize_model_response(result)

    return LiteLLMTraceRedactor()


def install_litellm_hook() -> bool:
    if _installed["litellm"]:
        return False
    try:
        import litellm
    except ImportError:
        return False
    redactor = _build_litellm_redactor()
    litellm.callbacks = list(getattr(litellm, "callbacks", None) or []) + [redactor]
    _installed["litellm"] = True
    return True


def install_trace_redaction() -> None:
    settings = get_settings()
    if not (settings.enabled and settings.trace_redaction_enabled):
        return
    try:
        install_langsmith_hooks()
        install_litellm_hook()
    except Exception:
        logger.warning("Trace redaction hooks could not be installed; disabling LLM message logging.")
        try:
            import litellm
            litellm.turn_off_message_logging = True  # fail closed for traces
        except ImportError:
            pass
