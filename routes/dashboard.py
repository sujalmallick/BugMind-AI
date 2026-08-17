from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from services.dashboard_service import (
    get_my_dashboard,
    get_project_dashboard,
    get_team_dashboard,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/me")
def read_my_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_dashboard(db=db, user_id=current_user.id)


@router.get("/projects/{project_id}")
def read_project_dashboard(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_project_dashboard(db=db, user_id=current_user.id, project_id=project_id)


@router.get("/organizations/{org_id}/teams/{team_id}")
def read_team_dashboard(
    org_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_team_dashboard(db=db, user_id=current_user.id, org_id=org_id, team_id=team_id)