"""
guardrails/audit_logger.py — security audit events with safe metadata only.

Events are single-line JSON on the "BugMind.security" logger:

    {"event": "guardrail", "guardrail": "input", "decision": "block",
     "request_id": "...", "agent": "module_agent", "signals": [...],
     "entities": {"EMAIL": 1}, "latency_ms": 1.4, "ts": "..."}

Only enumerated metadata is accepted: identifiers, decisions, rule ids,
entity names and counts. Free-text values are passed through the masker as
a last line of defence, but callers should never pass raw content.
"""

import json
import logging
import time
from contextvars import ContextVar
from datetime import datetime, timezone

from guardrails.config import get_settings

_request_id: ContextVar[str | None] = ContextVar("bugmind_request_id", default=None)

security_logger = logging.getLogger("BugMind.security")


def set_request_id(request_id: str | None):
    return _request_id.set(request_id)


def get_request_id() -> str | None:
    return _request_id.get()


def _safe(value):
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        from guardrails.data_masker import masker
        return masker.redact(value[:200])
    if isinstance(value, dict):
        return {str(k)[:64]: _safe(v) for k, v in list(value.items())[:50]}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_safe(v) for v in list(value)[:50]]
    return type(value).__name__


class AuditLogger:
    def event(
        self,
        guardrail: str,
        decision: str,
        *,
        agent: str | None = None,
        tool: str | None = None,
        source: str | None = None,
        field: str | None = None,
        success: bool = True,
        latency_ms: float | None = None,
        entities: dict[str, int] | None = None,
        signals: list[str] | None = None,
        score: float | None = None,
        reasons: list[str] | None = None,
        level: int | None = None,
    ) -> None:
        if not get_settings().audit_log_enabled:
            return
        payload = {
            "event": "guardrail",
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "request_id": get_request_id(),
            "guardrail": guardrail,
            "decision": getattr(decision, "value", decision),
            "agent": agent,
            "tool": tool,
            "source": getattr(source, "value", source),
            "field": field,
            "success": success,
            "latency_ms": round(latency_ms, 2) if latency_ms is not None else None,
            "entities": entities or None,
            "signals": signals or None,
            "score": score,
            "reasons": reasons or None,
        }
        payload = {k: _safe(v) for k, v in payload.items() if v is not None}
        if level is None:
            level = logging.INFO if payload.get("decision") in ("allow", "sanitize") else logging.WARNING
        security_logger.log(level, json.dumps(payload, separators=(",", ":")))


class Timer:
    def __init__(self):
        self.start = time.perf_counter()

    @property
    def elapsed_ms(self) -> float:
        return (time.perf_counter() - self.start) * 1000


audit = AuditLogger()
