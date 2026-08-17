from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db

from schemas.issue import IssueCreate

from services.issue_service import (
    save_issue,
    get_issues,
    bulk_import_issues,
    update_issue,
    delete_issue,
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
    issues = get_issues(db=db, project_id=project_id, owner_id=current_user.id)
    return [
        {
            "id": i.id,
            "bug_id": i.bug_id,
            "title": i.title,
            "description": i.description,
            "severity": i.severity,
            "priority": i.priority,
            "status": i.status,
            "reproduction_steps": i.reproduction_steps,
            "expected_result": i.expected_result,
            "actual_result": i.actual_result,
            "custom_fields": i.custom_fields or {},
            "assignee_id": i.assignee_id,
            "reporter_id": i.reporter_id,
            "created_at": i.created_at.isoformat() if i.created_at else None,
            "updated_at": i.updated_at.isoformat() if i.updated_at else None,
        }
        for i in issues
    ]


@router.put("/{project_id}/{issue_id}")
def edit_issue(
    project_id: int,
    issue_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    i = update_issue(
        db=db,
        project_id=project_id,
        issue_id=issue_id,
        current_user_id=current_user.id,
        data=data,
    )
    return {
        "id": i.id,
        "bug_id": i.bug_id,
        "title": i.title,
        "description": i.description,
        "severity": i.severity,
        "priority": i.priority,
        "status": i.status,
        "reproduction_steps": i.reproduction_steps,
        "expected_result": i.expected_result,
        "actual_result": i.actual_result,
        "custom_fields": i.custom_fields or {},
    }


@router.delete("/{project_id}/{issue_id}")
def remove_issue(
    project_id: int,
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_issue(
        db=db,
        project_id=project_id,
        issue_id=issue_id,
        current_user_id=current_user.id,
    )


@router.post("/{project_id}/bulk-import")
def bulk_import_issues_endpoint(
    project_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = data.get("issues", [])
    errors = []
    try:
        created = bulk_import_issues(
            db=db,
            project_id=project_id,
            current_user_id=current_user.id,
            data_list=items,
        )
        return {"imported": len(created), "errors": errors}
    except Exception as e:
        import traceback
        detail = str(e)
        print(f"[bulk-import] ERROR: {detail}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Import failed: {detail}")
