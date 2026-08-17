from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

class MentionSchema(BaseModel):
    id: int
    mentioned_user_id: int
    notified: bool

    class Config:
        from_attributes = True

class ReactionSchema(BaseModel):
    id: int
    user_id: int
    emoji: str

    class Config:
        from_attributes = True

class CommentAuthor(BaseModel):
    id: int
    name: str
    username: Optional[str]
    avatar_url: Optional[str]

    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    entity_type: str = Field(..., description="'test_case' or 'issue'")
    entity_id: int
    body: str

class CommentCreate(CommentBase):
    parent_id: Optional[int] = None

class CommentUpdate(BaseModel):
    body: str

class CommentResponse(CommentBase):
    id: int
    author_id: Optional[int]
    parent_id: Optional[int]
    is_edited: bool
    edited_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    author: Optional[CommentAuthor]
    reactions: List[ReactionSchema] = []
    mentions: List[MentionSchema] = []
    replies: List['CommentResponse'] = []

    @field_validator('replies', 'reactions', 'mentions', mode='before')
    @classmethod
    def coerce_none_to_list(cls, v):
        return v if v is not None else []

    class Config:
        from_attributes = True

CommentResponse.model_rebuild()

class ReactionCreate(BaseModel):
    emoji: str
