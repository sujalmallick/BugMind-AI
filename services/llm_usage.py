"""
services/llm_usage.py

One structured "llm_call" log event per provider attempt (tokens, estimated
cost, latency, outcome), plus an optional per-HTTP-request collector so a
whole workflow analysis can be summarized in a single "llm_request" line.

Events go to the "BugMind.llm" logger as single-line JSON. They carry
identifiers and numbers only, never prompt or response text.
"""

import json
import logging
from contextvars import ContextVar
from dataclasses import asdict, dataclass

from guardrails import get_request_id

usage_logger = logging.getLogger("BugMind.llm")

_request_calls: ContextVar[list | None] = ContextVar("bugmind_llm_request_calls", default=None)


@dataclass
class LLMCallRecord:
    agent: str | None
    provider: str
    model: str
    user_id: int | None
    byok: bool
    json_mode: bool
    outcome: str  # "ok", "guardrail_blocked", or an LLMError code
    latency_ms: float
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    cost_usd: float | None = None  # LiteLLM price-table estimate; None when the model isn't priced


def extract_usage(response, model: str | None = None) -> dict:
    """Token counts and estimated cost from a LiteLLM response. Never raises."""
    usage = getattr(response, "usage", None)
    data = {
        "prompt_tokens": getattr(usage, "prompt_tokens", None),
        "completion_tokens": getattr(usage, "completion_tokens", None),
        "total_tokens": getattr(usage, "total_tokens", None),
        "cost_usd": None,
    }
    try:
        import litellm

        cost = litellm.completion_cost(completion_response=response, model=model)
        data["cost_usd"] = round(float(cost), 6) if cost is not None else None
    except Exception:
        pass
    return data


def record_llm_call(record: LLMCallRecord) -> None:
    calls = _request_calls.get()
    if calls is not None:
        calls.append(record)

    payload = {"event": "llm_call", "request_id": get_request_id(), **asdict(record)}
    payload["latency_ms"] = round(record.latency_ms, 1)
    payload = {k: v for k, v in payload.items() if v is not None}
    level = logging.INFO if record.outcome == "ok" else logging.WARNING
    usage_logger.log(level, json.dumps(payload, separators=(",", ":")))


def start_request_collection():
    """Begin collecting llm_call records for the current request. Returns a reset token."""
    return _request_calls.set([])


def finish_request_collection(token, *, method: str, path: str, status_code: int | None) -> dict | None:
    """Log one "llm_request" summary if the request made any LLM calls, and stop collecting."""
    calls = _request_calls.get() or []
    _request_calls.reset(token)
    if not calls:
        return None

    def total(field):
        values = [getattr(c, field) for c in calls if getattr(c, field) is not None]
        return sum(values) if values else None

    summary = {
        "event": "llm_request",
        "request_id": get_request_id(),
        "method": method,
        "path": path,
        "status_code": status_code,
        "calls": len(calls),
        "failed_calls": sum(1 for c in calls if c.outcome != "ok"),
        "agents": sorted({c.agent for c in calls if c.agent}),
        "prompt_tokens": total("prompt_tokens"),
        "completion_tokens": total("completion_tokens"),
        "total_tokens": total("total_tokens"),
        "cost_usd": round(total("cost_usd"), 6) if total("cost_usd") is not None else None,
        "llm_latency_ms": round(sum(c.latency_ms for c in calls), 1),
    }
    summary = {k: v for k, v in summary.items() if v not in (None, [])}
    usage_logger.info(json.dumps(summary, separators=(",", ":")))
    return summary
