from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from auth.dependencies import get_current_user
from database.session import get_db
from services.activity_service import get_project_activity, get_my_activity
from database.models.user import User

router = APIRouter(prefix="/api/activity", tags=["Activity"])

@router.get("/projects/{project_id}")
def read_project_activity(
    project_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get activity feed for a project (viewer+)."""
    return get_project_activity(db=db, project_id=project_id, current_user_id=current_user.id, page=page, limit=limit)

@router.get("/me")
def read_my_activity(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get activity performed by the current user across the system."""
    return get_my_activity(db=db, user_id=current_user.id, page=page, limit=limit)
