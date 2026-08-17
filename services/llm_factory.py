import logging
from services.ai_settings_service import ai_settings_service
from services.llm_manager import LLMManager

logger = logging.getLogger("BugMind")


def build_llm_manager(db, user_id) -> LLMManager:
    """
    Builds an LLMManager for the given user by loading their saved AI
    settings (provider, model, and optionally an encrypted BYOK API key)
    from the database.

    Key resolution (handled inside LiteLLMProvider):
        1. User's encrypted API key (if saved) — decrypted here.
        2. Developer .env key for the matching provider.
        3. Raises ValueError if neither is available.
    """

    provider = ai_settings_service.get_provider(db, user_id)
    model    = ai_settings_service.get_model(db, user_id)
    api_key  = ai_settings_service.get_api_key(db, user_id)  # None if not set

    logger.debug(
        f"Factory Build | Provider={provider} | Model={model} | BYOK={api_key is not None}"
    )

    return LLMManager(
        provider=provider,
        model=model,
        api_key=api_key,  # None → LiteLLMProvider falls back to .env key
    )