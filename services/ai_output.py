"""
services/ai_output.py — safety check for model-written text that becomes a
person's own input later (a drafted workflow, a test plan phase's scope).
"""

from guardrails import Decision, Source, injection_detector, output_guardrail
from guardrails.policy_engine import policy


def safe_generated_text(text: str, agent: str) -> str | None:
    """
    The text after the output guardrail (secrets, prompt leaks, dangerous commands),
    or None when it must be dropped: withheld by that guardrail, or carrying a prompt
    injection. Instructions smuggled in from a document stop here instead of being
    laundered into trusted user input.
    """
    checked = output_guardrail.validate(text, agent=agent)
    if checked.blocked:
        return None
    report = injection_detector.assess(checked.sanitized_text, source=Source.LLM)
    if policy.injection_decision(Source.LLM, report.score) != Decision.ALLOW:
        return None
    return checked.sanitized_text.strip() or None
