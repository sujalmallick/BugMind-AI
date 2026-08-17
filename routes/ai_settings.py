from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from database.session import get_db
from auth.dependencies import get_current_user

from schemas.ai_settings import AISettingsUpdate

from services.encryption_service import EncryptionService
from services.ai_settings_service import ai_settings_service, KNOWN_PROVIDERS
from services.llm_factory import build_llm_manager

from database.models.user import User
from database.models.user_ai_settings import UserAISettings


encryption_service = EncryptionService()

router = APIRouter(
    prefix="/ai-settings",
    tags=["AI Settings"],
)


@router.get("")
def get_ai_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = (
        db.query(UserAISettings)
        .filter(
            UserAISettings.user_id == current_user.id
        )
        .first()
    )

    providers_status = ai_settings_service.get_providers_status(settings)

    if not settings:
        return {
            "provider": "gemini",
            "model": "gemini/gemini-2.5-flash",
            "providers": providers_status,
        }

    return {
        "provider": settings.provider,
        "model": settings.model,
        "providers": providers_status,
    }


@router.put("")
def update_ai_settings(
    request: AISettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    allowed_providers = [
        "gemini",
        "openai",
        "anthropic",
        "deepseek",
        "groq",
    ]

    allowed_models = {
        "gemini": [
            "gemini/gemini-2.5-flash",
            "gemini/gemini-2.5-pro",
        ],
        "openai": [
            "openai/gpt-4o-mini",
            "openai/gpt-4o",
        ],
        "anthropic": [
            "anthropic/claude-sonnet-4-20250514",
        ],
        "deepseek": [
            "deepseek/deepseek-chat",
        ],
        "groq": [
            "groq/llama-3.3-70b-versatile",
        ],
    }

    if request.provider not in allowed_providers:
        return {
            "success": False,
            "error": "Unsupported provider",
        }

    if request.model not in allowed_models.get(
        request.provider,
        [],
    ):
        return {
            "success": False,
            "error": "Invalid model",
        }

    settings = (
        db.query(UserAISettings)
        .filter(
            UserAISettings.user_id == current_user.id
        )
        .first()
    )

    if not settings:
        settings = UserAISettings(
            user_id=current_user.id,
            provider_keys={},
        )
        db.add(settings)

    settings.provider = request.provider
    settings.model = request.model

    if request.api_key:
        # Merge new key into provider_keys without touching other providers
        keys = dict(settings.provider_keys or {})
        keys[request.provider] = {
            "encrypted_key": encryption_service.encrypt_key(request.api_key)
        }
        settings.provider_keys = keys

    db.commit()
    db.refresh(settings)

    return {
        "success": True,
        "provider": settings.provider,
        "model": settings.model,
        "providers": ai_settings_service.get_providers_status(settings),
    }


@router.delete("/key/{provider}")
def delete_provider_key(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if provider not in KNOWN_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")

    settings = (
        db.query(UserAISettings)
        .filter(UserAISettings.user_id == current_user.id)
        .first()
    )

    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    keys = dict(settings.provider_keys or {})
    keys.pop(provider, None)
    settings.provider_keys = keys

    db.commit()
    db.refresh(settings)

    return {
        "success": True,
        "providers": ai_settings_service.get_providers_status(settings),
    }

