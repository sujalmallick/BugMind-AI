"""
guardrails/policy_engine.py — one place that turns findings into actions.

    Invalid input              → reject with a safe error
    Prompt injection (user)    → block at/above block threshold, sanitize when flagged
    Prompt injection (data)    → never obeyed; neutralize, redact spans at block threshold
    PII                        → mask (configurable per stage)
    Secrets                    → always redact, at every stage
    Unknown / unauthorized tool→ deny
    High-risk tool             → require explicit confirmation
    Guardrail error            → fail closed (configurable; always closed for high-risk tools)
"""

from enum import Enum

from guardrails.config import get_settings
from guardrails.detection import PII, SECRET
from guardrails.models import Decision, RiskLevel, Source


class Stage(str, Enum):
    INPUT = "input"            # user input entering the pipeline
    EGRESS = "egress"          # final prompt leaving for the LLM provider
    OUTPUT = "output"          # model / agent output
    TOOL_ARGS = "tool_args"    # arguments passed to a tool
    TOOL_RESULT = "tool_result"
    LOG = "log"
    TRACE = "trace"


class PolicyEngine:
    def mask_kinds(self, stage: Stage) -> tuple[str, ...]:
        s = get_settings()
        if stage in (Stage.LOG, Stage.TRACE):
            return (SECRET, PII)
        if stage == Stage.OUTPUT:
            return (SECRET, PII) if s.output_pii_redaction else (SECRET,)
        return (SECRET, PII) if s.pii_masking_enabled else (SECRET,)

    def stage_exclusions(self, stage: "Stage | str") -> frozenset[str]:
        """
        Entities not masked at a given stage.

        Contextual "password: X" values are excluded at egress and in model
        output: user input is masked on entry, so the model never receives a
        real password, and what it emits is synthetic QA test data (or a
        developer few-shot example in the prompt template). Format-identifiable
        secrets and exact matches of real in-process secrets are still always
        redacted. Set OUTPUT_REDACT_TEST_CREDENTIALS=true to redact them too.
        """
        stage = getattr(stage, "value", stage)
        if stage == Stage.EGRESS.value:
            return frozenset({"PASSWORD"})
        if stage == Stage.OUTPUT.value and not get_settings().output_redact_test_credentials:
            return frozenset({"PASSWORD"})
        return frozenset()

    def injection_decision(self, source: Source, score: float) -> Decision:
        s = get_settings()
        if score < s.injection_flag_threshold:
            return Decision.ALLOW
        if source.is_direct and score >= s.injection_block_threshold:
            return Decision.BLOCK
        return Decision.SANITIZE

    def redact_injection_spans(self, source: Source, score: float) -> bool:
        """Untrusted data that clearly carries an attack has the attack text removed."""
        return not source.is_direct and score >= get_settings().injection_block_threshold

    def requires_confirmation(self, risk: RiskLevel, declared: bool) -> bool:
        return declared or risk in (RiskLevel.HIGH, RiskLevel.CRITICAL)

    def fail_closed(self, risk: RiskLevel | None = None) -> bool:
        if risk in (RiskLevel.HIGH, RiskLevel.CRITICAL):
            return True
        return get_settings().fail_closed


policy = PolicyEngine()
