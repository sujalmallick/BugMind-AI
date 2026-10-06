"""
guardrails/input_guardrail.py — runs before any text reaches an agent or LLM.

    result = input_guardrail.validate(user_input)
    if result.blocked:
        return result.error_response()
    safe_text = result.sanitized_text

validate() is for entry points: direct user input can be blocked.
contain() is for data being placed into a prompt (DB records, documents,
other agents' output): it never blocks, it neutralizes and masks.
"""

import re

from guardrails.audit_logger import Timer, audit
from guardrails.config import get_settings
from guardrails.data_masker import MaskingVault, masker
from guardrails.injection_detector import (
    REMOVED_MARKER,
    injection_detector,
    neutralize,
    redact_spans,
)
from guardrails.models import Decision, GuardrailResult, InjectionAssessment, Source
from guardrails.policy_engine import Stage, policy

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

INJECTION_MESSAGE = (
    "Your input looks like an attempt to override the AI's instructions (prompt injection), "
    "so it was not processed. Please describe your workflow without instructions aimed at the AI."
)
INVALID_MESSAGE = "Invalid input."
TOO_LONG_MESSAGE = "Input is too long."
ERROR_MESSAGE = "Input could not be safety-checked. Please try again."


class InputGuardrail:
    name = "input"

    def validate(
        self,
        text,
        *,
        source: Source = Source.USER,
        field: str | None = None,
        agent: str | None = None,
        enforce: bool = True,
        vault: MaskingVault | None = None,
    ) -> GuardrailResult:
        settings = get_settings()
        if not settings.enabled:
            return GuardrailResult(guardrail=self.name, decision=Decision.ALLOW, sanitized_text=text or "")

        timer = Timer()
        try:
            return self._validate(text, source, field, agent, enforce, vault, timer)
        except Exception:
            fail_closed = policy.fail_closed()
            audit.event(
                self.name, "block" if fail_closed else "allow", agent=agent, source=source,
                field=field, success=False, reasons=["guardrail_error"], latency_ms=timer.elapsed_ms,
            )
            if fail_closed:
                return GuardrailResult(
                    guardrail=self.name, decision=Decision.BLOCK,
                    reasons=["guardrail_error"], user_message=ERROR_MESSAGE,
                )
            return GuardrailResult(guardrail=self.name, decision=Decision.ALLOW, sanitized_text=text or "")

    def _validate(self, text, source, field, agent, enforce, vault, timer) -> GuardrailResult:
        settings = get_settings()

        if text is None:
            text = ""
        if not isinstance(text, str):
            return self._reject(INVALID_MESSAGE, "invalid_type", source, field, agent, timer)
        if len(text) > settings.max_input_chars:
            return self._reject(TOO_LONG_MESSAGE, "too_long", source, field, agent, timer)

        working = _CONTROL_CHARS.sub("", text)
        reasons: list[str] = []
        assessment: InjectionAssessment | None = None

        if settings.prompt_injection_check_enabled:
            report = injection_detector.assess(working, source=source)
            decision = policy.injection_decision(source, report.score)
            assessment = InjectionAssessment(
                score=report.score,
                signals=report.signals,
                flagged=decision != Decision.ALLOW,
                should_block=decision == Decision.BLOCK,
            )
            if decision == Decision.BLOCK and enforce:
                audit.event(
                    self.name, Decision.BLOCK, agent=agent, source=source, field=field,
                    signals=report.signals, score=report.score, reasons=["prompt_injection"],
                    latency_ms=timer.elapsed_ms,
                )
                return GuardrailResult(
                    guardrail="prompt_injection", decision=Decision.BLOCK, injection=assessment,
                    reasons=["prompt_injection"], user_message=INJECTION_MESSAGE,
                )
            if assessment.flagged:
                if policy.redact_injection_spans(source, report.score) or (not enforce and assessment.should_block):
                    working = redact_spans(working, report.spans) if report.spans else REMOVED_MARKER
                    reasons.append("prompt_injection_redacted")
                else:
                    reasons.append("prompt_injection_flagged")

        neutralized = neutralize(working)
        if neutralized != working:
            reasons.append("structure_neutralized")
        working = neutralized

        masked = masker.mask(working, kinds=policy.mask_kinds(Stage.INPUT), stage="input", vault=vault)
        if masked.changed:
            reasons.append("sensitive_data_masked")

        decision = Decision.SANITIZE if (reasons or masked.text != text) else Decision.ALLOW
        if decision != Decision.ALLOW or assessment and assessment.score > 0:
            audit.event(
                self.name, decision, agent=agent, source=source, field=field,
                entities=masked.entity_counts, signals=assessment.signals if assessment else None,
                score=assessment.score if assessment else None, reasons=reasons,
                latency_ms=timer.elapsed_ms,
            )
        return GuardrailResult(
            guardrail=self.name,
            decision=decision,
            sanitized_text=masked.text,
            entity_counts=masked.entity_counts,
            injection=assessment,
            reasons=reasons,
        )

    def _reject(self, message, reason, source, field, agent, timer) -> GuardrailResult:
        audit.event(self.name, Decision.BLOCK, agent=agent, source=source, field=field,
                    reasons=[reason], latency_ms=timer.elapsed_ms)
        return GuardrailResult(
            guardrail=self.name, decision=Decision.BLOCK, reasons=[reason], user_message=message,
        )

    def validate_many(
        self,
        items: list | None,
        *,
        source: Source = Source.USER,
        field: str | None = None,
        agent: str | None = None,
    ) -> tuple[list[str] | None, GuardrailResult | None]:
        """Validate a list of strings. Returns (sanitized_items, blocking_result)."""
        if items is None:
            return None, None
        sanitized = []
        for item in items:
            result = self.validate(item, source=source, field=field, agent=agent)
            if result.blocked:
                return None, result
            sanitized.append(result.sanitized_text)
        return sanitized, None

    def contain(
        self,
        text: str,
        *,
        source: Source,
        field: str | None = None,
        agent: str | None = None,
        vault: MaskingVault | None = None,
    ) -> str:
        """Make data safe to embed in a prompt. Never blocks; fails closed by withholding."""
        result = self.validate(text, source=source, field=field, agent=agent, enforce=False, vault=vault)
        if result.blocked:
            return "[content withheld by input guardrail]"
        return result.sanitized_text


input_guardrail = InputGuardrail()
