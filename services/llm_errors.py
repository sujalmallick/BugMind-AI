"""
services/llm_errors.py

Typed LLM failures. classify_llm_error() maps whatever the provider stack
raised (LiteLLM exception types first, message keywords as a fallback) to one
LLMError subclass, so callers decide on retries and user messaging by type
instead of by substring.

The user_message strings are shown in the UI; keep them stable.
"""

import math
import re

import litellm.exceptions as litellm_errors


class LLMError(Exception):
    code = "unknown"
    user_message = "AI service error."
    retryable = False

    def __init__(self, detail: str = ""):
        super().__init__(detail or self.user_message)
        self.detail = detail

    def to_response(self) -> dict:
        """The {"success": False, ...} shape the agents and graph route on."""
        return {"success": False, "error": self.user_message, "code": self.code}


class LLMRateLimitError(LLMError):
    code = "rate_limited"
    user_message = "AI Quota exceeded. Please try again later."
    retryable = True

    def __init__(self, detail: str = "", retry_after: float | None = None):
        super().__init__(detail)
        # Seconds the provider asked us to wait, when it said (header or message).
        self.retry_after = retry_after
        if retry_after is not None:
            self.user_message = f"AI Quota exceeded. Please try again in {_humanize_wait(retry_after)}."


class LLMAuthError(LLMError):
    code = "auth"
    user_message = "Invalid or missing API Key."


class LLMModelUnavailableError(LLMError):
    code = "model_unavailable"
    user_message = "The selected AI model is unavailable or incorrect."


class LLMProviderUnavailableError(LLMError):
    code = "provider_unavailable"
    user_message = "AI Provider is currently offline or timed out. Please try again."


class LLMContextWindowError(LLMError):
    code = "context_too_long"
    user_message = "The input is too long for the selected AI model. Shorten it or choose a model with a larger context window."


class LLMContentPolicyError(LLMError):
    code = "content_policy"
    user_message = "The AI provider declined this request under its content policy."


class LLMUnknownError(LLMError):
    code = "unknown"

    def __init__(self, detail: str = "", sanitized_detail: str = ""):
        super().__init__(detail)
        self.user_message = f"AI service error: {sanitized_detail}" if sanitized_detail else "AI service error."


# Most specific first: ContextWindow/ContentPolicy subclass BadRequestError.
_TYPE_MAP: list[tuple[tuple[type, ...], type[LLMError]]] = [
    ((litellm_errors.ContextWindowExceededError,), LLMContextWindowError),
    ((litellm_errors.ContentPolicyViolationError,), LLMContentPolicyError),
    ((litellm_errors.RateLimitError,), LLMRateLimitError),
    ((litellm_errors.AuthenticationError, litellm_errors.PermissionDeniedError), LLMAuthError),
    ((litellm_errors.NotFoundError,), LLMModelUnavailableError),
    (
        (
            litellm_errors.Timeout,
            litellm_errors.APIConnectionError,
            litellm_errors.ServiceUnavailableError,
            litellm_errors.InternalServerError,
            litellm_errors.BadGatewayError,
        ),
        LLMProviderUnavailableError,
    ),
]

# Fallback for non-LiteLLM exceptions (e.g. our own "No API key found" ValueError).
# Order matches the previous string matcher, minus its bare "model" keyword, which
# misreported unrelated errors that merely mentioned a model.
_KEYWORD_MAP: list[tuple[tuple[str, ...], type[LLMError]]] = [
    (("rate limit", "quota", "429", "resource exhausted", "too many requests"), LLMRateLimitError),
    (("401", "403", "unauthorized", "forbidden", "api key", "invalid key"), LLMAuthError),
    (
        ("not found", "404", "does not exist", "decommissioned", "llm provider not provided"),
        LLMModelUnavailableError,
    ),
    (("502", "503", "504", "timeout", "timed out", "connection", "offline"), LLMProviderUnavailableError),
]


_DURATION_PART = re.compile(r"(\d+(?:\.\d+)?)\s*(ms|h|m|s)", re.IGNORECASE)
_UNIT_SECONDS = {"ms": 0.001, "s": 1, "m": 60, "h": 3600}
_TRY_AGAIN = re.compile(r"try again in\s+([0-9hms.\s]+)", re.IGNORECASE)


def parse_duration(text: str) -> float | None:
    """'7.66s', '2m59.56s', '1h2m3s', '450ms' -> seconds. None when nothing parses."""
    parts = _DURATION_PART.findall(str(text or ""))
    if not parts:
        return None
    return sum(float(value) * _UNIT_SECONDS[unit.lower()] for value, unit in parts)


def _retry_after_seconds(err: Exception) -> float | None:
    """
    How long the provider asked us to wait: the Retry-After header, else the
    "Please try again in 7.66s" hint in Groq-style messages, else the longest
    x-ratelimit-reset-* header. None when the provider gave no hint.
    """
    headers = getattr(err, "litellm_response_headers", None) or getattr(getattr(err, "response", None), "headers", None)
    try:
        headers = {str(k).lower(): str(v) for k, v in dict(headers or {}).items()}
    except (TypeError, ValueError):
        headers = {}

    try:
        if "retry-after" in headers:
            return max(0.0, float(headers["retry-after"]))
    except ValueError:
        pass

    match = _TRY_AGAIN.search(str(err))
    if match and (seconds := parse_duration(match.group(1))) is not None:
        return seconds

    resets = [parse_duration(headers[h]) for h in ("x-ratelimit-reset-tokens", "x-ratelimit-reset-requests") if h in headers]
    resets = [r for r in resets if r is not None]
    return max(resets) if resets else None


def _humanize_wait(seconds: float) -> str:
    if seconds < 60:
        return f"{max(1, math.ceil(seconds))} seconds"
    if seconds < 3600:
        minutes = math.ceil(seconds / 60)
        return f"about {minutes} minute{'s' if minutes != 1 else ''}"
    hours = round(seconds / 3600)
    return f"about {hours} hour{'s' if hours != 1 else ''}"


def _build(error_cls: type[LLMError], err: Exception, detail: str) -> LLMError:
    if error_cls is LLMRateLimitError:
        return LLMRateLimitError(detail, retry_after=_retry_after_seconds(err))
    return error_cls(detail)


def classify_llm_error(err: Exception) -> LLMError:
    if isinstance(err, LLMError):
        return err

    detail = str(err)

    for types, error_cls in _TYPE_MAP:
        if isinstance(err, types):
            return _build(error_cls, err, detail)

    lowered = detail.lower()
    for keywords, error_cls in _KEYWORD_MAP:
        if any(kw in lowered for kw in keywords):
            return _build(error_cls, err, detail)

    from guardrails import output_guardrail

    return LLMUnknownError(detail, sanitized_detail=output_guardrail.sanitize_error(err))
