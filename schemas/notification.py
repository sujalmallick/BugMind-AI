from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class NotificationPreferenceBase(BaseModel):
    type: str = Field(..., description="'mention', 'assignment', 'invite', 'comment'")
    enabled: bool = True
    via_email: bool = False

class NotificationPreferenceUpdate(BaseModel):
    enabled: Optional[bool] = None
    via_email: Optional[bool] = None

class NotificationPreferenceResponse(NotificationPreferenceBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class NotificationBase(BaseModel):
    type: str = "system"
    title: str
    message: str
    action_url: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    project_id: Optional[int] = None
    org_id: Optional[int] = None

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    actor_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    items: List[NotificationResponse]

class UnreadCountResponse(BaseModel):
    unread_count: int
