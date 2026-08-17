from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.session import get_db
from database.models.user import User
from auth.dependencies import get_current_user
from auth.permissions import require_project_role
from schemas.ai_workload import AIAssignmentSuggestionResponse, ApplySuggestionsRequest
from services.ai_workload_service import (
    generate_suggestions,
    get_latest_suggestion,
    apply_suggestions,
    dismiss_suggestion
)

router = APIRouter(prefix="/projects/{project_id}/ai", tags=["ai_workload"])

@router.post("/suggest-assignments", response_model=AIAssignmentSuggestionResponse)
def suggest_assignments_route(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_role(db, current_user.id, project_id, min_role="admin")
    return generate_suggestions(db, project_id, current_user.id)

@router.get("/suggestions", response_model=AIAssignmentSuggestionResponse)
def get_suggestions_route(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_role(db, current_user.id, project_id, min_role="viewer")
    suggestion = get_latest_suggestion(db, project_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="No pending suggestions")
    return suggestion

@router.post("/suggestions/{suggestion_id}/apply", status_code=status.HTTP_204_NO_CONTENT)
def apply_suggestions_route(
    project_id: int,
    suggestion_id: int,
    payload: ApplySuggestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_role(db, current_user.id, project_id, min_role="admin")
    apply_suggestions(db, suggestion_id, payload.selected_indices)

@router.delete("/suggestions/{suggestion_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_suggestion_route(
    project_id: int,
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_role(db, current_user.id, project_id, min_role="admin")
    dismiss_suggestion(db, suggestion_id)
