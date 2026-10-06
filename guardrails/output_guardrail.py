"""
guardrails/output_guardrail.py — inspects everything a model or agent produces.

    result = output_guardrail.validate(agent_output, agent="module_agent")
    if result.blocked:
        ...  # withheld: system prompt leak
    safe = result.sanitized_text

Checks, in order:
  1. Hidden reasoning blocks (<think>…</think> etc.) are stripped.
  2. System-prompt leakage: the per-process canary, or long verbatim overlap
     with the instruction part of the prompt → output withheld.
  3. Destructive shell commands → redacted.
  4. Secrets → always redacted. PII → redacted (configurable), except
     reserved documentation domains such as example.com used as test data.
"""

import re
from typing import Any

from guardrails.audit_logger import Timer, audit
from guardrails.config import get_settings
from guardrails.data_masker import masker
from guardrails.detection import SECRET
from guardrails.models import Decision, GuardrailResult
from guardrails.policy_engine import Stage, policy
from guardrails.prompt_safety import CANARY, SECURITY_PREAMBLE, instruction_portion

_REASONING_BLOCK = re.compile(
    r"<(think|thinking|reasoning|scratchpad|inner_monologue)>[\s\S]*?</\1>\s*", re.IGNORECASE
)
_UNCLOSED_REASONING = re.compile(r"<(think|thinking|reasoning|scratchpad)>[\s\S]*\Z", re.IGNORECASE)

_DANGEROUS_COMMAND = re.compile(
    r"\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:--no-preserve-root\s+)?(?:/|~|\*|/\*)(?=\s|$|[\"'`])"
    r"|:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:"
    r"|\bmkfs(?:\.\w+)?\s+/dev/\S+"
    r"|\bdd\s+if=\S+\s+of=/dev/(?:sd|nvme|hd|disk)\S*"
    r"|\b(?:curl|wget)\b[^|\n]{0,200}\|\s*(?:sudo\s+)?(?:ba|z)?sh\b"
    r"|\bformat\s+[a-z]:\s*/[a-z]"
    r"|\bpowershell(?:\.exe)?\s+-(?:e|enc|encodedcommand)\s+[A-Za-z0-9+/=]{20,}"
    r"|\bdel\s+/[sfq]\s+/[sfq]\s+[a-z]:\\",
    re.IGNORECASE,
)
UNSAFE_COMMAND_MARKER = "[UNSAFE_COMMAND_REDACTED]"

LEAK_MESSAGE = "The AI response was withheld because it appeared to disclose internal instructions."

_SHINGLE = 8
_LEAK_MIN_SHINGLES = 3
# Lines that are formatting examples in a prompt; a model legitimately mirrors these.
_EXAMPLE_LINE = re.compile(r"[{}\[\]\"]|e\.g\.|example", re.IGNORECASE)


def _shingles(text: str) -> set[tuple[str, ...]]:
    words = re.findall(r"[a-z0-9']+", text.lower())
    return {tuple(words[i:i + _SHINGLE]) for i in range(len(words) - _SHINGLE + 1)}


def _instruction_shingles(prompt: str) -> set[tuple[str, ...]]:
    lines = [ln for ln in instruction_portion(prompt).splitlines() if not _EXAMPLE_LINE.search(ln)]
    return _shingles("\n".join(lines))


_PREAMBLE_SHINGLES = _instruction_shingles(SECURITY_PREAMBLE)


def strip_reasoning(text: str) -> str:
    text = _REASONING_BLOCK.sub("", text)
    return _UNCLOSED_REASONING.sub("", text)


class OutputGuardrail:
    name = "output"

    def leaks_prompt(self, text: str, protected_prompt: str | None = None) -> str | None:
        if CANARY in text:
            return "canary"
        out = _shingles(text)
        if len(out & _PREAMBLE_SHINGLES) >= _LEAK_MIN_SHINGLES:
            return "preamble_overlap"
        if protected_prompt and len(out & _instruction_shingles(protected_prompt)) >= _LEAK_MIN_SHINGLES:
            return "instruction_overlap"
        return None

    def validate(
        self,
        output: str,
        *,
        agent: str | None = None,
        protected_prompt: str | None = None,
    ) -> GuardrailResult:
        settings = get_settings()
        if not settings.enabled or not isinstance(output, str):
            return GuardrailResult(guardrail=self.name, decision=Decision.ALLOW,
                                   sanitized_text=output if isinstance(output, str) else "")

        timer = Timer()
        try:
            if not settings.output_guardrails_enabled:
                # Layer disabled: secrets are still never allowed out.
                masked = masker.mask(output, kinds=(SECRET,), stage="output")
                return GuardrailResult(
                    guardrail=self.name,
                    decision=Decision.SANITIZE if masked.changed else Decision.ALLOW,
                    sanitized_text=masked.text, entity_counts=masked.entity_counts,
                )
            return self._validate(output, agent, protected_prompt, timer)
        except Exception:
            audit.event(self.name, "block", agent=agent, success=False,
                        reasons=["guardrail_error"], latency_ms=timer.elapsed_ms)
            if policy.fail_closed():
                return GuardrailResult(guardrail=self.name, decision=Decision.BLOCK,
                                       reasons=["guardrail_error"],
                                       user_message="The AI response could not be safety-checked.")
            return GuardrailResult(guardrail=self.name, decision=Decision.ALLOW, sanitized_text=output)

    def _validate(self, output: str, agent, protected_prompt, timer) -> GuardrailResult:
        reasons: list[str] = []
        text = strip_reasoning(output)
        if text != output:
            reasons.append("reasoning_stripped")

        leak = self.leaks_prompt(text, protected_prompt)
        if leak:
            audit.event(self.name, Decision.BLOCK, agent=agent, reasons=[f"system_prompt_leak:{leak}"],
                        latency_ms=timer.elapsed_ms)
            return GuardrailResult(guardrail="system_prompt_leak", decision=Decision.BLOCK,
                                   reasons=[f"system_prompt_leak:{leak}"], user_message=LEAK_MESSAGE)

        text, n_cmd = _DANGEROUS_COMMAND.subn(UNSAFE_COMMAND_MARKER, text)
        if n_cmd:
            reasons.append("unsafe_command_redacted")

        masked = masker.mask(text, kinds=policy.mask_kinds(Stage.OUTPUT), stage="output")
        if masked.changed:
            reasons.append("sensitive_data_redacted")

        decision = Decision.SANITIZE if reasons else Decision.ALLOW
        if decision != Decision.ALLOW:
            audit.event(self.name, decision, agent=agent, entities=masked.entity_counts,
                        reasons=reasons, latency_ms=timer.elapsed_ms)
        return GuardrailResult(guardrail=self.name, decision=decision, sanitized_text=masked.text,
                               entity_counts=masked.entity_counts, reasons=reasons)

    def validate_obj(self, obj: Any, *, agent: str | None = None) -> tuple[Any, GuardrailResult]:
        """Sanitize every string in a structured (JSON-like) response."""
        counts: dict[str, int] = {}
        reasons: set[str] = set()
        blocked: list[GuardrailResult] = []

        def walk(value: Any) -> Any:
            if isinstance(value, str):
                result = self.validate(value, agent=agent)
                if result.blocked:
                    blocked.append(result)
                    return ""
                for k, v in result.entity_counts.items():
                    counts[k] = counts.get(k, 0) + v
                reasons.update(result.reasons)
                return result.sanitized_text
            if isinstance(value, dict):
                return {k: walk(v) for k, v in value.items()}
            if isinstance(value, (list, tuple)):
                return type(value)(walk(v) for v in value)
            return value

        sanitized = walk(obj)
        if blocked:
            return None, blocked[0]
        decision = Decision.SANITIZE if reasons else Decision.ALLOW
        return sanitized, GuardrailResult(guardrail=self.name, decision=decision,
                                          entity_counts=counts, reasons=sorted(reasons))

    def sanitize_error(self, message: Any, limit: int = 300) -> str:
        """Make an exception / provider error message safe to return to a client."""
        text = str(message or "")
        try:
            text = masker.redact(text, kinds=policy.mask_kinds(Stage.LOG), stage="log")
        except Exception:
            return "An internal error occurred."
        return text[:limit]


output_guardrail = OutputGuardrail()
