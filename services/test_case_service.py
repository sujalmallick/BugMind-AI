"""
services/test_case_service.py
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.models.project import Project
from database.models.workspace import Workspace
from database.models.test_case import TestCase
from auth.permissions import require_project_role
from services.activity_service import log_activity, Verb

def _get_workspace(db: Session, project_id: int):
    ws = db.query(Workspace).filter(Workspace.project_id == project_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found for this project.")
    return ws

def save_test_cases(
    db: Session,
    project_id: int,
    current_user_id: int,
    test_cases: list,
):
    """
    Overwrites AI-generated test cases but preserves manual test cases.
    """
    require_project_role(db, current_user_id, project_id, "editor")
    workspace = _get_workspace(db, project_id)

    # Delete all non-manual test cases
    db.query(TestCase).filter(
        TestCase.workspace_id == workspace.id,
        TestCase.is_manual == False
    ).delete()

    for tc in test_cases:
        test_case = TestCase(
            workspace_id=workspace.id,
            test_case_id=tc.get("id", ""),
            description=tc.get("description", ""),
            module=tc.get("module", ""),
            category=tc.get("category", ""),
            priority=tc.get("priority", ""),
            status=tc.get("status", "Not Executed"),
            preconditions=tc.get("preconditions", ""),
            steps=tc.get("steps", ""),
            expected_result=tc.get("expectedResult", ""),
            actual_result=tc.get("actualResult", ""),
            notes=tc.get("notes", ""),
            is_manual=False
        )
        db.add(test_case)
    db.commit()
    return {"success": True}


def get_test_cases(
    db: Session,
    project_id: int,
    current_user_id: int,
):
    require_project_role(db, current_user_id, project_id, "viewer")
    workspace = _get_workspace(db, project_id)

    return (
        db.query(TestCase)
        .filter(TestCase.workspace_id == workspace.id)
        .all()
    )


def create_manual_test_case(db: Session, project_id: int, current_user_id: int, data: dict):
    require_project_role(db, current_user_id, project_id, "editor")
    workspace = _get_workspace(db, project_id)
    
    tc = TestCase(
        workspace_id=workspace.id,
        test_case_id=data.get("test_case_id", f"MANUAL-{data.get('module', 'GEN')[:3].upper()}"),
        description=data.get("description", ""),
        module=data.get("module", "General"),
        category=data.get("category", "Functional"),
        priority=data.get("priority", "Medium"),
        status="Not Executed",
        preconditions=data.get("preconditions", ""),
        steps=data.get("steps", ""),
        expected_result=data.get("expected_result", ""),
        actual_result="",
        notes=data.get("notes", ""),
        is_manual=True
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)
    log_activity(
        db=db,
        verb=Verb.CREATED_TEST_CASE,
        entity_type="test_case",
        entity_id=tc.id,
        entity_label=tc.description or tc.test_case_id,
        actor_id=current_user_id,
        project_id=project_id,
        org_id=None,
        meta=None,
    )
    return tc


def bulk_create_manual_test_cases(db: Session, project_id: int, current_user_id: int, data_list: list):
    require_project_role(db, current_user_id, project_id, "editor")
    workspace = _get_workspace(db, project_id)
    
    created = []
    for data in data_list:
        tc = TestCase(
            workspace_id=workspace.id,
            test_case_id=data.get("test_case_id") or f"MANUAL-{str(data.get('module', 'GEN'))[:3].upper()}",
            description=data.get("description", ""),
            module=data.get("module", "General"),
            category=data.get("category", "Functional"),
            priority=data.get("priority", "Medium"),
            status=data.get("status", "Not Executed"),
            preconditions=data.get("preconditions", ""),
            steps=data.get("steps", ""),
            expected_result=data.get("expected_result", ""),
            actual_result=data.get("actual_result", ""),
            notes=data.get("notes", ""),
            is_manual=True
        )
        db.add(tc)
        created.append(tc)
    
    db.commit()
    for tc in created:
        db.refresh(tc)
        
    log_activity(
        db=db,
        verb=Verb.CREATED_TEST_CASE,
        entity_type="test_case",
        entity_id=workspace.id, # Using workspace id as entity for bulk to avoid spamming
        entity_label=f"Imported {len(created)} test cases",
        actor_id=current_user_id,
        project_id=project_id,
        org_id=None,
        meta={"count": len(created)},
    )
    return created


def update_test_case(db: Session, project_id: int, tc_id: int, current_user_id: int, data: dict):
    require_project_role(db, current_user_id, project_id, "editor")
    
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")
        
    ws = _get_workspace(db, project_id)
    if tc.workspace_id != ws.id:
        raise HTTPException(status_code=403, detail="Test case does not belong to this project.")
        
    for key, value in data.items():
        if hasattr(tc, key) and key not in ("id", "workspace_id", "created_at", "updated_at", "assignee_id", "assigned_at"):
            setattr(tc, key, value)
            
    db.commit()
    db.refresh(tc)
    return tc


def delete_test_case(db: Session, project_id: int, tc_id: int, current_user_id: int):
    require_project_role(db, current_user_id, project_id, "editor")
    
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")
        
    ws = _get_workspace(db, project_id)
    if tc.workspace_id != ws.id:
        raise HTTPException(status_code=403, detail="Test case does not belong to this project.")
        
    db.delete(tc)
    db.commit()
    return {"success": True}