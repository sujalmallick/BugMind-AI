from pydantic import BaseModel, Field


class AISettingsUpdate(BaseModel):
    provider: str = Field(max_length=32)
    model: str = Field(max_length=128)
    api_key: str | None = Field(None, max_length=512)


class AISettingsResponse(BaseModel):
    provider: str
    model: str
    has_api_key: bool


class AISettingsTestKeyRequest(BaseModel):
    provider: str = Field(max_length=32)
    model: str | None = Field(None, max_length=128)
    api_key: str | None = Field(None, max_length=512)