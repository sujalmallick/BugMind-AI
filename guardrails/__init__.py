"""
BugMind guardrails — centralized security layer for the agentic pipeline.

    from guardrails import input_guardrail, output_guardrail, tool_guardrail, masker

    result = input_guardrail.validate(user_input)
    sanitized = masker.mask(text).text
    result = output_guardrail.validate(agent_output)
    result = tool_guardrail.authorize(tool_name=..., arguments=..., user_context=...)

Configuration flags are documented in .env.example.
"""

from guardrails.audit_logger import audit, get_request_id, set_request_id
from guardrails.config import get_settings, reload_settings
from guardrails.data_masker import DataMasker, MaskingVault, masker
from guardrails.injection_detector import injection_detector
from guardrails.input_guardrail import input_guardrail
from guardrails.log_redaction import install_log_redaction
from guardrails.models import (
    Decision,
    GuardrailResult,
    GuardrailViolation,
    RiskLevel,
    Source,
    ToolAuthorizationResult,
)
from guardrails.output_guardrail import output_guardrail
from guardrails.prompt_safety import SECURITY_PREAMBLE, untrusted_block, wrap_untrusted
from guardrails.secret_detector import known_secrets
from guardrails.tool_guardrail import ToolSpec, UserContext, tool_guardrail, tool_registry
from guardrails.tracing import install_trace_redaction

_bootstrapped = False


def bootstrap() -> None:
    """Install process-wide hooks (log + trace redaction). Idempotent."""
    global _bootstrapped
    if _bootstrapped:
        return
    install_log_redaction()
    install_trace_redaction()
    _bootstrapped = True


__all__ = [
    "audit", "bootstrap", "get_request_id", "set_request_id", "get_settings", "reload_settings",
    "DataMasker", "MaskingVault", "masker", "injection_detector", "input_guardrail",
    "output_guardrail", "tool_guardrail", "tool_registry", "ToolSpec", "UserContext",
    "Decision", "GuardrailResult", "GuardrailViolation", "RiskLevel", "Source",
    "ToolAuthorizationResult", "SECURITY_PREAMBLE", "untrusted_block", "wrap_untrusted",
    "known_secrets", "install_log_redaction", "install_trace_redaction",
]
