"""
guardrails/config.py — environment-driven guardrail settings.

Every switch defaults to the secure option. Nothing secret lives here; the only
secret the guardrails use (the confirmation-token HMAC key) is read from the
environment at call time.
"""

import os
import threading
from dataclasses import dataclass, field


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_set(name: str, default: str = "") -> frozenset[str]:
    raw = os.getenv(name, default) or ""
    return frozenset(v.strip().lower() for v in raw.split(",") if v.strip())


@dataclass(frozen=True)
class GuardrailSettings:
    # Master + per-layer switches
    enabled: bool = True
    pii_masking_enabled: bool = True
    prompt_injection_check_enabled: bool = True
    output_guardrails_enabled: bool = True
    tool_guardrails_enabled: bool = True
    log_redaction_enabled: bool = True
    trace_redaction_enabled: bool = True
    audit_log_enabled: bool = True

    # Fail closed when a guardrail itself errors.
    fail_closed: bool = True

    # Prompt-injection score thresholds (0..1).
    injection_block_threshold: float = 0.8
    injection_flag_threshold: float = 0.45

    # Masking behaviour. "typed" → [EMAIL_REDACTED]; "indexed" → [EMAIL_1].
    mask_style: str = "typed"
    min_detection_score: float = 0.5
    # Entities (upper-case names, e.g. PERSON,ADDRESS) that should not be masked.
    disabled_entities: frozenset[str] = field(default_factory=frozenset)

    # Output: redact PII the model emits (secrets are always redacted).
    output_pii_redaction: bool = True
    # Redact synthetic "password: X" test data in model output (see PolicyEngine.stage_exclusions).
    output_redact_test_credentials: bool = False
    # Reserved documentation domains are safe synthetic test data in outputs.
    safe_email_domains: frozenset[str] = field(
        default_factory=lambda: frozenset({"example.com", "example.org", "example.net"})
    )

    max_input_chars: int = 50_000
    confirmation_ttl_seconds: int = 300

    @classmethod
    def from_env(cls) -> "GuardrailSettings":
        style = (os.getenv("PII_MASK_STYLE", "typed") or "typed").strip().lower()
        return cls(
            enabled=_env_bool("GUARDRAILS_ENABLED", True),
            pii_masking_enabled=_env_bool("PII_MASKING_ENABLED", True),
            prompt_injection_check_enabled=_env_bool("PROMPT_INJECTION_CHECK_ENABLED", True),
            output_guardrails_enabled=_env_bool("OUTPUT_GUARDRAILS_ENABLED", True),
            tool_guardrails_enabled=_env_bool("TOOL_GUARDRAILS_ENABLED", True),
            log_redaction_enabled=_env_bool("LOG_REDACTION_ENABLED", True),
            trace_redaction_enabled=_env_bool("TRACE_REDACTION_ENABLED", True),
            audit_log_enabled=_env_bool("GUARDRAIL_AUDIT_LOG_ENABLED", True),
            fail_closed=_env_bool("FAIL_CLOSED_ON_GUARDRAIL_ERROR", True),
            injection_block_threshold=_env_float("PROMPT_INJECTION_BLOCK_THRESHOLD", 0.8),
            injection_flag_threshold=_env_float("PROMPT_INJECTION_FLAG_THRESHOLD", 0.45),
            mask_style=style if style in {"typed", "indexed"} else "typed",
            min_detection_score=_env_float("PII_MIN_DETECTION_SCORE", 0.5),
            disabled_entities=frozenset(e.upper() for e in _env_set("PII_DISABLED_ENTITIES")),
            output_pii_redaction=_env_bool("OUTPUT_PII_REDACTION_ENABLED", True),
            output_redact_test_credentials=_env_bool("OUTPUT_REDACT_TEST_CREDENTIALS", False),
            safe_email_domains=_env_set(
                "PII_SAFE_EMAIL_DOMAINS", "example.com,example.org,example.net"
            ),
            max_input_chars=_env_int("GUARDRAIL_MAX_INPUT_CHARS", 50_000),
            confirmation_ttl_seconds=_env_int("TOOL_CONFIRMATION_TTL_SECONDS", 300),
        )


_settings: GuardrailSettings | None = None
_lock = threading.Lock()


def get_settings() -> GuardrailSettings:
    global _settings
    if _settings is None:
        with _lock:
            if _settings is None:
                _settings = GuardrailSettings.from_env()
    return _settings


def reload_settings() -> GuardrailSettings:
    """Re-read the environment (used by tests and config hot-reload)."""
    global _settings
    with _lock:
        _settings = GuardrailSettings.from_env()
    return _settings


def confirmation_secret() -> bytes | None:
    """HMAC key for tool confirmation tokens — never hardcoded."""
    key = os.getenv("GUARDRAILS_CONFIRMATION_SECRET") or os.getenv("SECRET_KEY")
    return key.encode() if key else None
