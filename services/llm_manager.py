from providers.litellm_provider import LiteLLMProvider

from guardrails import (
    SECURITY_PREAMBLE,
    GuardrailViolation,
    audit,
    get_settings,
    known_secrets,
    masker,
    output_guardrail,
)
from guardrails.policy_engine import Stage, policy


class LLMManager:

    def __init__(
        self,
        provider: str = "gemini",
        model: str = None,
        api_key: str | None = None,
    ):
        # A user's BYOK key must never surface in logs, traces or responses.
        known_secrets.register(api_key)

        self.provider_instance = LiteLLMProvider(
            provider=provider,
            model=model,
            api_key=api_key,   # Pass through — LiteLLMProvider handles resolution
        )

    def generate(self, prompt: str, agent: str | None = None) -> str:
        """
        Every LLM call passes through here:
          egress  — backstop masking of anything upstream missed
          system  — security preamble sent as a separate, trusted system message
          output  — output guardrail (reasoning strip, prompt-leak check, redaction)
        """
        if not get_settings().enabled:
            return self.provider_instance.generate(prompt)

        egress = masker.mask(prompt, kinds=policy.mask_kinds(Stage.EGRESS), stage=Stage.EGRESS.value)
        if egress.changed:
            audit.event("egress", "sanitize", agent=agent, entities=egress.entity_counts)

        raw = self.provider_instance.generate(egress.text, system=SECURITY_PREAMBLE)
        if not raw:
            return raw

        result = output_guardrail.validate(raw, agent=agent, protected_prompt=egress.text)
        if result.blocked:
            raise GuardrailViolation(result.guardrail, result.user_message, result.reasons)
        return result.sanitized_text
