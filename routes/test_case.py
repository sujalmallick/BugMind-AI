from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
    db: Session = Depends(get_db),
):
    return save_test_cases(
        db=db,
        project_id=project_id,
        test_cases=data.test_cases,
    )


@router.get("/{project_id}")
def fetch_test_cases(
    project_id: int,
    db: Session = Depends(get_db),
):
    return get_test_cases(
        db=db,
        project_id=project_id,
    )