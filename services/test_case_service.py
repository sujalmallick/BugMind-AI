"""
services/test_case_service.py
"""

import logging

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

def _normalize_steps(steps) -> str:
    if isinstance(steps, list):
        return "\n".join(str(s).strip() for s in steps if s and str(s).strip())
    if steps is None:
        return ""
    return str(steps).strip()

def save_test_cases(
    db: Session,
    project_id: int,
    current_user_id: int,
    test_cases: list,
):
    """
    Syncs the AI-generated test cases to `test_cases`; manual test cases are untouched.

    Rows are matched by (display id, description). A match is updated in place, so
    its database id, assignee, custom fields and linked issues survive. This is
    what a status change re-sends. Unmatched incoming cases are inserted. Stored
    AI cases that are no longer in the list (a re-analysis replaced them) are
    deleted after their issues move to the IMPORT-DEFAULT placeholder, so no
    bug report is lost or blocks the save.
    """
    require_project_role(db, current_user_id, project_id, "editor")
    workspace = _get_workspace(db, project_id)

    existing = (
        db.query(TestCase)
        .filter(TestCase.workspace_id == workspace.id, TestCase.is_manual == False)
        .order_by(TestCase.id)
        .all()
    )
    unmatched: dict[tuple[str, str], TestCase] = {}
    for row in existing:
        unmatched.setdefault(_match_key(row.test_case_id, row.description), row)

    for tc in test_cases:
        row = unmatched.pop(_match_key(tc.get("id", ""), tc.get("description", "")), None)
        if row is None:
            row = TestCase(workspace_id=workspace.id, is_manual=False)
            db.add(row)
        row.test_case_id = tc.get("id", "")
        row.description = tc.get("description", "")
        row.module = tc.get("module", "")
        row.category = tc.get("category", "")
        row.priority = tc.get("priority", "")
        row.status = tc.get("status", "Not Executed")
        row.preconditions = str(tc.get("preconditions", "") or "")
        row.steps = _normalize_steps(tc.get("steps", ""))
        row.expected_result = str(tc.get("expectedResult", "") or "")
        row.actual_result = str(tc.get("actualResult", "") or "")
        row.notes = str(tc.get("notes", "") or "")
        if "custom_fields" in tc:
            row.custom_fields = dict(tc.get("custom_fields") or {})

    kept_ids = {row.id for row in existing} - {row.id for row in unmatched.values()}
    stale_ids = [row.id for row in existing if row.id not in kept_ids]
    if stale_ids:
        _move_issues_to_placeholder(db, workspace, stale_ids)
        db.query(TestCase).filter(TestCase.id.in_(stale_ids)).delete(synchronize_session=False)

    db.commit()
    return {"success": True}


PLACEHOLDER_TEST_CASE_ID = "IMPORT-DEFAULT"


def _match_key(display_id, description) -> tuple[str, str]:
    return (str(display_id or "").strip(), str(description or "").strip())


def get_or_create_placeholder_test_case(db: Session, workspace: Workspace) -> TestCase:
    """The per-workspace row that issues without a real test case hang off."""
    placeholder = (
        db.query(TestCase)
        .filter(TestCase.workspace_id == workspace.id, TestCase.test_case_id == PLACEHOLDER_TEST_CASE_ID)
        .first()
    )
    if not placeholder:
        placeholder = TestCase(
            workspace_id=workspace.id,
            test_case_id=PLACEHOLDER_TEST_CASE_ID,
            description="Auto-created for CSV-imported issues",
            module="General",
            category="Bug",
            priority="Medium",
            status="Not Executed",
            preconditions="",
            steps="",
            expected_result="",
            actual_result="",
            notes="",
            is_manual=True,
            custom_fields={},
        )
        db.add(placeholder)
        db.flush()
    return placeholder


def _move_issues_to_placeholder(db: Session, workspace: Workspace, test_case_ids: list[int]) -> None:
    """Keep bug reports whose test case is going away (TestCase.issues would cascade-delete them)."""
    from database.models.issue import Issue

    db.flush()  # persist pending edits before the bulk update + expire below
    if not db.query(Issue.id).filter(Issue.test_case_id.in_(test_case_ids)).first():
        return
    placeholder = get_or_create_placeholder_test_case(db, workspace)
    db.query(Issue).filter(Issue.test_case_id.in_(test_case_ids)).update(
        {Issue.test_case_id: placeholder.id}, synchronize_session=False
    )
    db.expire_all()  # loaded test_case.issues collections are now stale


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
        preconditions=str(data.get("preconditions", "") or ""),
        steps=_normalize_steps(data.get("steps", "")),
        expected_result=str(data.get("expected_result", "") or ""),
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
    
    import uuid
    created = []
    try:
        for data in data_list:
            provided_id = data.get("test_case_id")
            if provided_id:
                raw_tc_id = str(provided_id)
            else:
                mod_prefix = str(data.get('module', 'GEN'))[:3].upper()
                raw_tc_id = f"MANUAL-{mod_prefix}-{uuid.uuid4().hex[:4].upper()}"
            
            tc = TestCase(
                workspace_id=workspace.id,
                test_case_id=raw_tc_id[:30],
                description=str(data.get("description") or ""),
                module=str(data.get("module") or "General")[:100],
                category=str(data.get("category") or "Functional")[:50],
                priority=str(data.get("priority") or "Medium")[:20],
                status=str(data.get("status") or "Not Executed")[:30],
                preconditions=str(data.get("preconditions") or ""),
                steps=str(data.get("steps") or ""),
                expected_result=str(data.get("expected_result") or ""),
                actual_result=str(data.get("actual_result") or ""),
                notes=str(data.get("notes") or ""),
                is_manual=True,
                custom_fields=data.get("custom_fields") or {}
            )
            db.add(tc)
            created.append(tc)
        
        db.commit()
        for tc in created:
            db.refresh(tc)
    except Exception:
        db.rollback()
        # Driver errors embed SQL, parameters and schema details: log, don't return.
        logging.getLogger("BugMind").error("Test case bulk import failed", exc_info=True)
        raise HTTPException(status_code=400, detail="Import failed. Check the file format and try again.")

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


# Columns an editor may change through the generic update endpoint. Assignment
# goes through /api/test-cases/{id}/assign; ids, relationships and timestamps
# are server-managed. Other keys are ignored.
EDITABLE_TEST_CASE_FIELDS = {
    "test_case_id", "description", "module", "category", "priority", "status",
    "preconditions", "steps", "expected_result", "actual_result", "notes", "is_manual",
}


def update_test_case(db: Session, project_id: int, tc_id: int, current_user_id: int, data: dict):
    require_project_role(db, current_user_id, project_id, "editor")
    
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")
        
    ws = _get_workspace(db, project_id)
    if tc.workspace_id != ws.id:
        raise HTTPException(status_code=403, detail="Test case does not belong to this project.")
        
    for key, value in data.items():
        if key == "custom_fields" and isinstance(value, dict):
            existing_custom = dict(tc.custom_fields or {})
            existing_custom.update(value)
            tc.custom_fields = existing_custom
        elif key in EDITABLE_TEST_CASE_FIELDS:
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

    from database.models.issue import Issue

    if tc.test_case_id == PLACEHOLDER_TEST_CASE_ID:
        if db.query(Issue.id).filter(Issue.test_case_id == tc.id).first():
            # Deleting it would cascade-delete every issue filed without a real test case.
            raise HTTPException(
                status_code=409,
                detail="This placeholder holds issues that aren't linked to a test case; it can't be deleted.",
            )
    else:
        # Bugs reported from this test case outlive it.
        _move_issues_to_placeholder(db, ws, [tc.id])
        tc = db.get(TestCase, tc_id)

    db.delete(tc)
    db.commit()
    return {"success": True}