import time

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
from services.llm_errors import classify_llm_error
from services.llm_usage import LLMCallRecord, record_llm_call


class LLMManager:

    def __init__(
        self,
        provider: str = "gemini",
        model: str = None,
        api_key: str | None = None,
        user_id: int | None = None,
    ):
        # A user's BYOK key must never surface in logs, traces or responses.
        known_secrets.register(api_key)

        self.user_id = user_id
        self.byok = api_key is not None
        self.provider_instance = LiteLLMProvider(
            provider=provider,
            model=model,
            api_key=api_key,   # Pass through — LiteLLMProvider handles resolution
        )

    def generate(self, prompt: str, agent: str | None = None, json_mode: bool = False) -> str:
        """
        Every LLM call passes through here:
          egress  — backstop masking of anything upstream missed
          system  — security preamble sent as a separate, trusted system message
          output  — output guardrail (reasoning strip, prompt-leak check, redaction)
          usage   — one llm_call event (tokens, cost, latency, outcome) per attempt

        Provider failures are raised as typed LLMError subclasses.
        """
        start = time.perf_counter()
        usage: dict = {}
        outcome = "ok"
        try:
            if not get_settings().enabled:
                text, usage = self.provider_instance.generate_with_usage(prompt, json_mode=json_mode)
                return text

            egress = masker.mask(prompt, kinds=policy.mask_kinds(Stage.EGRESS), stage=Stage.EGRESS.value)
            if egress.changed:
                audit.event("egress", "sanitize", agent=agent, entities=egress.entity_counts)

            raw, usage = self.provider_instance.generate_with_usage(
                egress.text, system=SECURITY_PREAMBLE, json_mode=json_mode
            )
            if not raw:
                return raw

            result = output_guardrail.validate(raw, agent=agent, protected_prompt=egress.text)
            if result.blocked:
                outcome = "guardrail_blocked"
                raise GuardrailViolation(result.guardrail, result.user_message, result.reasons)
            return result.sanitized_text

        except GuardrailViolation:
            raise
        except Exception as err:
            typed = classify_llm_error(err)
            outcome = typed.code
            raise typed from err
        finally:
            record_llm_call(LLMCallRecord(
                agent=agent,
                provider=self.provider_instance.provider,
                model=usage.get("model") or self.provider_instance.model or "",
                user_id=self.user_id,
                byok=self.byok,
                json_mode=json_mode,
                outcome=outcome,
                latency_ms=(time.perf_counter() - start) * 1000,
                prompt_tokens=usage.get("prompt_tokens"),
                completion_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
                cost_usd=usage.get("cost_usd"),
            ))
