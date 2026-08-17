from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db

from services.assignment_service import (
    assign_test_case,
    unassign_test_case,
    assign_issue,
    unassign_issue,
    get_my_assignments,
)

router = APIRouter(
    tags=["Assignments"],
)

@router.put("/test-cases/{tc_id}/assign")
def api_assign_test_case(
    tc_id: int,
    assignee_id: int = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return assign_test_case(db, tc_id, assignee_id, current_user.id)


@router.put("/test-cases/{tc_id}/unassign")
def api_unassign_test_case(
    tc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return unassign_test_case(db, tc_id, current_user.id)


@router.put("/issues/{issue_id}/assign")
def api_assign_issue(
    issue_id: int,
    assignee_id: int = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return assign_issue(db, issue_id, assignee_id, current_user.id)


@router.put("/issues/{issue_id}/unassign")
def api_unassign_issue(
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return unassign_issue(db, issue_id, current_user.id)


@router.get("/me/assignments")
def api_get_my_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_assignments(db, current_user.id)
