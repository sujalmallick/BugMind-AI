"""
LLM access for guardrail checks (e.g. the prompt-injection classifier).

Single attempt, no retries: guardrail model checks fail open, so retrying
would only add latency (and spend quota the analysis itself needs).
"""

from database.session import SessionLocal
from services.llm_factory import build_llm_manager


def guardrail_llm(user_id: int | None, agent: str = "injection_classifier"):
    """A callable(prompt) -> str using the user's configured provider/model."""

    def call(prompt: str):
        if user_id:
            db = SessionLocal()
            try:
                manager = build_llm_manager(db, user_id)
            finally:
                db.close()
        else:
            from utils import default_llm_manager

            manager = default_llm_manager
        return manager.generate(prompt, agent=agent, json_mode=True)

    return call
