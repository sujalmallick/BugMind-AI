from pydantic import BaseModel


class AISettingsUpdate(BaseModel):
    provider: str
    model: str
    api_key: str | None = None


class AISettingsResponse(BaseModel):
    provider: str
    model: str
    has_api_key: bool


class AISettingsTestKeyRequest(BaseModel):
    provider: str
    model: str | None = None
    api_key: str | None = None