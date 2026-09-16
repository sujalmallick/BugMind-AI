from sqlalchemy.orm import Session

from database.models.user_ai_settings import UserAISettings
from services.encryption_service import EncryptionService

KNOWN_PROVIDERS = ["gemini", "openai", "anthropic", "groq", "deepseek"]


class AISettingsService:

    def __init__(self):
        self.encryption = EncryptionService()

    def get_settings(
        self,
        db: Session,
        user_id: int,
    ):
        return (
            db.query(UserAISettings)
            .filter(UserAISettings.user_id == user_id)
            .first()
        )

    def get_provider(
        self,
        db: Session,
        user_id: int,
    ) -> str:
        settings = self.get_settings(db, user_id)

        if not settings:
            return "groq"

        return settings.provider

    def get_model(
        self,
        db: Session,
        user_id: int,
    ) -> str:
        settings = self.get_settings(db, user_id)

        if not settings:
            # LiteLLM requires provider-prefixed model names.
            return "groq/llama-3.3-70b-versatile"

        return settings.model

    def get_api_key(
        self,
        db: Session,
        user_id: int,
        provider: str | None = None,
    ) -> str | None:
        """
        Returns the decrypted user API key for the specified provider (or active provider if None)
        if one is stored, otherwise None. None signals the provider to fall back to the
        .env developer key.
        """
        settings = self.get_settings(db, user_id)

        if not settings:
            return None

        target_provider = provider or settings.provider
        keys = settings.provider_keys or {}
        entry = keys.get(target_provider, {})
        encrypted = entry.get("encrypted_key")

        if not encrypted:
            return None

        return self.encryption.decrypt_key(encrypted)

    def get_providers_status(self, settings: UserAISettings) -> dict:
        """Return configured status for every known provider."""
        keys = (settings.provider_keys or {}) if settings else {}
        return {
            p: {"configured": bool(keys.get(p, {}).get("encrypted_key"))}
            for p in KNOWN_PROVIDERS
        }


ai_settings_service = AISettingsService()