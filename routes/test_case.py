from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from schemas.test_case import TestCaseSave

from services.test_case_service import (
    save_test_cases,
    get_test_cases,
    create_manual_test_case,
    update_test_case,
    delete_test_case,
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
        current_user_id=current_user.id,
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
        current_user_id=current_user.id,
    )


@router.post("/{project_id}/manual")
def add_manual_test_case(
    project_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_manual_test_case(
        db=db,
        project_id=project_id,
        current_user_id=current_user.id,
        data=data,
    )


@router.put("/{project_id}/{tc_id}")
def edit_test_case(
    project_id: int,
    tc_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_test_case(
        db=db,
        project_id=project_id,
        tc_id=tc_id,
        current_user_id=current_user.id,
        data=data,
    )


@router.delete("/{project_id}/{tc_id}")
def remove_test_case(
    project_id: int,
    tc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_test_case(
        db=db,
        project_id=project_id,
        tc_id=tc_id,
        current_user_id=current_user.id,
    )