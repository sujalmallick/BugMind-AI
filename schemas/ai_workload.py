from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel

class SuggestionItem(BaseModel):
    entity_type: Literal["test_case", "issue"]
    entity_id: int
    assignee_id: int
    reason: str

class AIAssignmentSuggestionResponse(BaseModel):
    id: int
    project_id: int
    requested_by: int
    suggestions: List[SuggestionItem]
    status: str
    created_at: datetime
    applied_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ApplySuggestionsRequest(BaseModel):
    selected_indices: List[int]
