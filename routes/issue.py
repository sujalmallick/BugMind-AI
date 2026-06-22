from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db

from schemas.issue import IssueCreate

from services.issue_service import (
    save_issue,
    get_issues,
)

router = APIRouter(
    prefix="/issues",
    tags=["Issues"],
)


@router.post("/{project_id}")
def create_issue(
    project_id: int,
    data: IssueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save_issue(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
        issue=data.issue,
    )


@router.get("/{project_id}")
def fetch_issues(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_issues(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
    )