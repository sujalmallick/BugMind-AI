from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db

from schemas.test_case import TestCaseSave

from services.test_case_service import (
    save_test_cases,
    get_test_cases,
)

router = APIRouter(
    prefix="/test-cases",
    tags=["Test Cases"],
)


@router.put("/{project_id}")
def update_test_cases(
    project_id: int,
    data: TestCaseSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save_test_cases(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
        test_cases=data.test_cases,
    )


@router.get("/{project_id}")
def fetch_test_cases(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_test_cases(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
    )