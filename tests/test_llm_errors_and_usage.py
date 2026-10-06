"""
Typed LLM errors (classification, retries, user-facing responses) and usage
events (one llm_call per attempt, one llm_request summary per HTTP request).
"""

import json
import logging
from types import SimpleNamespace

import httpx
import litellm.exceptions as lx
import pytest

from services.llm_errors import (
    LLMAuthError,
    LLMRateLimitError,
    classify_llm_error,
)

_KW = {"message": "provider said no", "llm_provider": "groq", "model": "groq/llama-3.3-70b-versatile"}
_403 = httpx.Response(403, request=httpx.Request("POST", "https://api.groq.com"))


@pytest.mark.parametrize("err, code", [
    (lx.RateLimitError(**_KW), "rate_limited"),
    (lx.AuthenticationError(**_KW), "auth"),
    (lx.PermissionDeniedError(**_KW, response=_403), "auth"),
    (lx.NotFoundError(**_KW), "model_unavailable"),
    (lx.Timeout(**_KW), "provider_unavailable"),
    (lx.APIConnectionError(**_KW), "provider_unavailable"),
    (lx.ServiceUnavailableError(**_KW), "provider_unavailable"),
    (lx.ContextWindowExceededError(**_KW), "context_too_long"),
    (lx.ContentPolicyViolationError(**_KW), "content_policy"),
    # Non-LiteLLM exceptions fall back to keywords
    (ValueError("No API key found for provider 'groq'."), "auth"),
    (RuntimeError("Error code: 429 - too many requests"), "rate_limited"),
    (RuntimeError("model_decommissioned: llama3-70b-8192 has been decommissioned"), "model_unavailable"),
    (RuntimeError("Read timed out"), "provider_unavailable"),
])
def test_classification(err, code):
    assert classify_llm_error(err).code == code


def test_mentioning_model_is_no_longer_misreported_as_model_unavailable():
    """The old matcher sent every error containing "model" to "model unavailable"."""
    err = classify_llm_error(RuntimeError("Unexpected token in model output stream"))
    assert err.code == "unknown"
    assert err.user_message.startswith("AI service error: ")


def test_unknown_error_message_is_sanitized():
    err = classify_llm_error(RuntimeError("upstream failed for key gsk_LEAKEDleakedLEAKED12345678"))
    assert "gsk_LEAKED" not in err.user_message


def test_user_messages_for_existing_categories_are_unchanged():
    assert LLMRateLimitError().to_response() == {
        "success": False, "error": "AI Quota exceeded. Please try again later.", "code": "rate_limited"}
    assert LLMAuthError().to_response()["error"] == "Invalid or missing API Key."


# ── call_llm retries ─────────────────────────────────────────────────────────

class FlakyCompletion:
    def __init__(self, failures: list[Exception], content='{"ok": true}', usage=None):
        self.failures = list(failures)
        self.calls = 0
        self.content = content
        self.usage = usage

    def __call__(self, **kwargs):
        self.calls += 1
        if self.failures:
            raise self.failures.pop(0)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=self.content))],
            usage=self.usage,
        )


@pytest.fixture
def no_sleep(monkeypatch):
    import utils

    sleeps = []
    monkeypatch.setattr(utils.time, "sleep", sleeps.append)
    return sleeps


def _patch_completion(monkeypatch, fake):
    import providers.litellm_provider as provider_module

    monkeypatch.setattr(provider_module, "completion", fake)


def test_rate_limit_is_retried_then_succeeds(monkeypatch, no_sleep):
    from utils import call_llm

    fake = FlakyCompletion([lx.RateLimitError(**_KW), lx.RateLimitError(**_KW)])
    _patch_completion(monkeypatch, fake)

    assert call_llm("Return JSON", agent="module_agent") == '{"ok": true}'
    assert fake.calls == 3
    assert no_sleep == [1, 2]


def test_rate_limit_gives_up_after_three_retries(monkeypatch, no_sleep):
    from utils import call_llm

    fake = FlakyCompletion([lx.RateLimitError(**_KW)] * 10)
    _patch_completion(monkeypatch, fake)

    result = call_llm("Return JSON", agent="module_agent")
    assert result == {"success": False, "error": "AI Quota exceeded. Please try again later.", "code": "rate_limited"}
    assert fake.calls == 4
    assert no_sleep == [1, 2, 4]


def test_non_retryable_errors_are_not_retried(monkeypatch, no_sleep):
    from utils import call_llm

    fake = FlakyCompletion([lx.AuthenticationError(**_KW)])
    _patch_completion(monkeypatch, fake)

    assert call_llm("Return JSON")["code"] == "auth"
    assert fake.calls == 1
    assert no_sleep == []


# ── Usage events ─────────────────────────────────────────────────────────────

def _llm_events(caplog, event):
    return [json.loads(r.getMessage()) for r in caplog.records
            if r.name == "BugMind.llm" and json.loads(r.getMessage())["event"] == event]


def test_successful_call_logs_tokens_cost_and_no_content(monkeypatch, caplog):
    from utils import call_llm

    caplog.set_level(logging.INFO, logger="BugMind.llm")
    usage = SimpleNamespace(prompt_tokens=1000, completion_tokens=500, total_tokens=1500)
    _patch_completion(monkeypatch, FlakyCompletion([], usage=usage))

    call_llm("SECRET-PROMPT-TEXT return JSON", agent="module_agent", json_mode=True)

    [event] = _llm_events(caplog, "llm_call")
    assert event["outcome"] == "ok"
    assert event["agent"] == "module_agent"
    assert event["provider"] == "groq"
    assert event["model"] == "groq/llama-3.3-70b-versatile"
    assert event["json_mode"] is True
    assert event["byok"] is False
    assert (event["prompt_tokens"], event["completion_tokens"], event["total_tokens"]) == (1000, 500, 1500)
    assert event["latency_ms"] >= 0
    assert "SECRET-PROMPT-TEXT" not in caplog.text


def test_cost_estimate_uses_litellm_price_table():
    import litellm

    from services.llm_usage import extract_usage

    response = litellm.ModelResponse(
        model="llama-3.3-70b-versatile",
        choices=[{"message": {"content": "{}", "role": "assistant"}}],
        usage={"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500},
    )
    usage = extract_usage(response, model="groq/llama-3.3-70b-versatile")
    assert usage["cost_usd"] > 0
    assert extract_usage(response, model="openrouter/openrouter/free")["cost_usd"] is None  # unpriced, no crash


def test_each_failed_attempt_is_logged_with_its_code(monkeypatch, caplog, no_sleep):
    from utils import call_llm

    caplog.set_level(logging.INFO, logger="BugMind.llm")
    _patch_completion(monkeypatch, FlakyCompletion([lx.RateLimitError(**_KW)]))

    call_llm("Return JSON", agent="issue_agent")

    assert [e["outcome"] for e in _llm_events(caplog, "llm_call")] == ["rate_limited", "ok"]


def test_workflow_request_logs_one_summary(client, fake_llm, agent_router, caplog):
    caplog.set_level(logging.INFO, logger="BugMind.llm")
    fake_llm.responder = agent_router(
        module=json.dumps({"confirmed_modules": ["Auth"]}),
        checklist=json.dumps({"checklist": [{"module": "Auth", "items": [{"text": "Lockout"}]}]}),
        test_cases=json.dumps({"test_cases": [{"module": "Auth"}]}),
    )

    res = client.post("/analyze-workflow", json={"workflow": "User logs in and pays for an order."})
    assert res.status_code == 200

    [summary] = _llm_events(caplog, "llm_request")
    assert summary["path"] == "/analyze-workflow"
    assert summary["status_code"] == 200
    assert summary["calls"] == 3
    assert summary["failed_calls"] == 0
    assert summary["agents"] == ["checklist_agent", "module_agent", "test_case_agent"]
    assert summary["request_id"] == res.headers["X-Request-ID"]


def test_requests_without_llm_calls_log_no_summary(client, caplog):
    caplog.set_level(logging.INFO, logger="BugMind.llm")
    client.get("/health")
    assert _llm_events(caplog, "llm_request") == []


# ── Workload service maps typed errors to HTTP status ────────────────────────

from test_workload_tool_guardrail import project_data  # noqa: E402,F401 — reuse the seeded project fixture


@pytest.mark.parametrize("err, status", [
    (lx.RateLimitError(**_KW), 429),
    (lx.ServiceUnavailableError(**_KW), 502),
    (lx.AuthenticationError(**_KW), 502),
])
def test_workload_llm_failures_become_clean_http_errors(project_data, monkeypatch, err, status):
    from fastapi import HTTPException

    from services.ai_workload_service import generate_suggestions

    _patch_completion(monkeypatch, FlakyCompletion([err]))
    with pytest.raises(HTTPException) as exc:
        generate_suggestions(project_data["db"], project_id=1, user_id=1)
    assert exc.value.status_code == status
    assert exc.value.detail == classify_llm_error(err).user_message
