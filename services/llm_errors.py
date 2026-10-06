"""
services/llm_errors.py

Typed LLM failures. classify_llm_error() maps whatever the provider stack
raised (LiteLLM exception types first, message keywords as a fallback) to one
LLMError subclass, so callers decide on retries and user messaging by type
instead of by substring.

The user_message strings are shown in the UI; keep them stable.
"""

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


def classify_llm_error(err: Exception) -> LLMError:
    if isinstance(err, LLMError):
        return err

    detail = str(err)

    for types, error_cls in _TYPE_MAP:
        if isinstance(err, types):
            return error_cls(detail)

    lowered = detail.lower()
    for keywords, error_cls in _KEYWORD_MAP:
        if any(kw in lowered for kw in keywords):
            return error_cls(detail)

    from guardrails import output_guardrail

    return LLMUnknownError(detail, sanitized_detail=output_guardrail.sanitize_error(err))
