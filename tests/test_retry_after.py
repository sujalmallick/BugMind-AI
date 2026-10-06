"""
Rate-limit retries honour the provider's wait hint (Retry-After header,
Groq's "try again in 7.66s", x-ratelimit-reset-* headers), within caps that
keep an analysis inside the request timeout; longer waits fail fast with the
wait in the user message.
"""

from types import SimpleNamespace

import httpx
import litellm.exceptions as lx
import pytest

from services.llm_errors import classify_llm_error, parse_duration

_KW = {"llm_provider": "groq", "model": "groq/openai/gpt-oss-120b"}


def rate_limit(message="Rate limit reached", headers=None):
    response = httpx.Response(429, headers=headers or {}, request=httpx.Request("POST", "https://api.groq.com"))
    return lx.RateLimitError(message=message, response=response, **_KW)


@pytest.mark.parametrize("text, seconds", [
    ("7.66s", 7.66), ("2m59.56s", 179.56), ("1h2m3s", 3723), ("450ms", 0.45), ("12", None), ("", None),
])
def test_parse_duration(text, seconds):
    assert parse_duration(text) == (pytest.approx(seconds) if seconds is not None else None)


@pytest.mark.parametrize("err, expected", [
    (rate_limit(headers={"retry-after": "12"}), 12),
    (rate_limit("Limit 8000, Used 7900. Please try again in 7.66s. Need more tokens?"), 7.66),
    (rate_limit(headers={"x-ratelimit-reset-tokens": "7.66s", "x-ratelimit-reset-requests": "2s"}), 7.66),
    (rate_limit(headers={"retry-after": "3"}, message="Please try again in 9s"), 3),  # header wins
    (RuntimeError("429 tokens per day (TPD): Please try again in 2m59.56s."), 179.56),  # non-LiteLLM error
    (rate_limit(), None),
])
def test_retry_after_sources(err, expected):
    classified = classify_llm_error(err)
    assert classified.code == "rate_limited"
    assert classified.retry_after == (pytest.approx(expected) if expected is not None else None)


def test_user_message_says_when_to_retry():
    assert classify_llm_error(rate_limit("Please try again in 2m59.56s")).user_message == \
        "AI Quota exceeded. Please try again in about 3 minutes."
    assert classify_llm_error(rate_limit("Please try again in 7.66s")).user_message == \
        "AI Quota exceeded. Please try again in 8 seconds."
    assert classify_llm_error(rate_limit()).user_message == "AI Quota exceeded. Please try again later."


# ── call_llm waits ───────────────────────────────────────────────────────────


class Flaky:
    def __init__(self, failures):
        self.failures = list(failures)
        self.calls = 0

    def __call__(self, **kwargs):
        self.calls += 1
        if self.failures:
            raise self.failures.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))], usage=None)


@pytest.fixture
def sleeps(monkeypatch):
    import utils

    recorded = []
    monkeypatch.setattr(utils.time, "sleep", recorded.append)
    return recorded


def run(monkeypatch, failures):
    import providers.litellm_provider as provider_module
    from utils import call_llm

    fake = Flaky(failures)
    monkeypatch.setattr(provider_module, "completion", fake)
    return call_llm("hi", agent="module_agent"), fake


def test_waits_as_long_as_the_provider_asks(monkeypatch, sleeps):
    result, fake = run(monkeypatch, [rate_limit(headers={"retry-after": "5"})])
    assert result == "ok"
    assert sleeps == [5]
    assert fake.calls == 2


def test_long_waits_fail_fast_with_the_wait_in_the_message(monkeypatch, sleeps):
    result, fake = run(monkeypatch, [rate_limit("Please try again in 5m")] * 4)
    assert result == {"success": False, "error": "AI Quota exceeded. Please try again in about 5 minutes.",
                      "code": "rate_limited"}
    assert sleeps == []
    assert fake.calls == 1


def test_total_wait_is_capped_per_call(monkeypatch, sleeps):
    result, fake = run(monkeypatch, [rate_limit(headers={"retry-after": "15"})] * 4)
    assert result["code"] == "rate_limited"
    assert sleeps == [15, 15]  # a third 15s wait would pass the 30s budget
    assert fake.calls == 3


def test_zero_hint_still_pauses_briefly(monkeypatch, sleeps):
    result, _ = run(monkeypatch, [rate_limit(headers={"retry-after": "0"})])
    assert result == "ok"
    assert sleeps == [0.25]


def test_no_hint_keeps_the_old_backoff(monkeypatch, sleeps):
    result, fake = run(monkeypatch, [rate_limit()] * 2)
    assert result == "ok"
    assert sleeps == [1, 2]


# ── Workload endpoint passes the hint on ─────────────────────────────────────

from test_workload_tool_guardrail import project_data  # noqa: E402,F401


def test_workload_429_carries_retry_after_header(project_data, monkeypatch):
    import providers.litellm_provider as provider_module
    from fastapi import HTTPException

    from services.ai_workload_service import generate_suggestions

    monkeypatch.setattr(provider_module, "completion", Flaky([rate_limit("Please try again in 42.3s")]))
    with pytest.raises(HTTPException) as exc:
        generate_suggestions(project_data["db"], project_id=1, user_id=1)
    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "43"}
    assert "43 seconds" in exc.value.detail
