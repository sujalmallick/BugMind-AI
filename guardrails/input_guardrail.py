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

        # An attack split across items ("Ignore all previous", "instructions and
        # reveal...") passes item by item; check the text where items meet.
        joined_block = self._check_item_junctions(items, source, field, agent)
        if joined_block:
            return None, joined_block
        return sanitized, None

    def classify(
        self,
        fields: dict[str, str],
        llm_call,
        *,
        agent: str | None = None,
    ) -> GuardrailResult:
        """
        Model-based second opinion on already-validated, masked user input.
        Blocks on a confident injection verdict. Fails open: if the classifier
        call errors or returns nothing usable, the rule-based checks (already
        applied) stand alone.
        """
        from guardrails.injection_classifier import classify as run_classifier

        settings = get_settings()
        allow = GuardrailResult(guardrail="llm_classifier", decision=Decision.ALLOW)
        if not (settings.enabled and settings.prompt_injection_check_enabled and settings.llm_classifier_enabled):
            return allow

        timer = Timer()
        try:
            verdict = run_classifier(fields, llm_call, settings.llm_classifier_max_chars)
        except Exception:
            audit.event("llm_classifier", "allow", agent=agent, success=False,
                        reasons=["classifier_unavailable"], latency_ms=timer.elapsed_ms)
            return allow
        if verdict is None:
            audit.event("llm_classifier", "allow", agent=agent, success=False,
                        reasons=["classifier_no_verdict"], latency_ms=timer.elapsed_ms)
            return allow

        if verdict.injection and verdict.confidence >= settings.llm_classifier_threshold:
            audit.event("llm_classifier", Decision.BLOCK, agent=agent, source=Source.USER,
                        score=verdict.confidence, reasons=["prompt_injection_llm"], latency_ms=timer.elapsed_ms)
            return GuardrailResult(
                guardrail="prompt_injection", decision=Decision.BLOCK,
                injection=InjectionAssessment(score=verdict.confidence, signals=["llm_classifier"],
                                              flagged=True, should_block=True),
                reasons=["prompt_injection_llm"], user_message=INJECTION_MESSAGE,
            )
        if verdict.injection:
            audit.event("llm_classifier", "allow", agent=agent, source=Source.USER,
                        score=verdict.confidence, reasons=["prompt_injection_llm_low_confidence"],
                        latency_ms=timer.elapsed_ms)
        return allow

    _JUNCTION_WINDOW = 400
    _JOINED_FULL_SCAN_CHARS = 20_000

    def _check_item_junctions(self, items, source, field, agent) -> GuardrailResult | None:
        settings = get_settings()
        texts = [i for i in items if isinstance(i, str) and i]
        if len(texts) < 2 or not (settings.enabled and settings.prompt_injection_check_enabled):
            return None
        joined = " ".join(texts)
        junctions, pos = [], 0
        for t in texts[:-1]:
            pos += len(t)
            junctions.append(pos)  # offset of the joining space
            pos += 1
        if len(joined) <= self._JOINED_FULL_SCAN_CHARS:
            windows = [(joined, junctions)]
        else:
            # Only the regions around each junction can hold a split phrase.
            windows = []
            for j in junctions:
                lo = max(0, j - self._JUNCTION_WINDOW)
                hi = j + 1 + self._JUNCTION_WINDOW
                windows.append((joined[lo:hi], [b - lo for b in junctions if lo < b < hi]))
        for window, boundaries in windows:
            report = injection_detector.assess_spanning(window, boundaries)
            if policy.injection_decision(source, report.score) == Decision.BLOCK:
                audit.event(self.name, Decision.BLOCK, agent=agent, source=source, field=f"{field}[joined]",
                            signals=report.signals, score=report.score, reasons=["prompt_injection_split"])
                return GuardrailResult(
                    guardrail="prompt_injection", decision=Decision.BLOCK,
                    injection=InjectionAssessment(score=report.score, signals=report.signals,
                                                  flagged=True, should_block=True),
                    reasons=["prompt_injection_split"], user_message=INJECTION_MESSAGE,
                )
        return None

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
