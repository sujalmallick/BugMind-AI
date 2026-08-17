"""
services/assignment_service.py

Handles assigning test cases and issues to project members,
and fetching personal work queues.
"""

from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from database.models.test_case import TestCase
from database.models.issue import Issue
from database.models.project import Project
from database.models.workspace import Workspace
from database.models.user import User
from auth.permissions import get_project_role, require_project_role
from services.activity_service import log_activity, Verb


def _verify_assignee_is_member(db: Session, project_id: int, assignee_id: int):
    """Ensure the assignee actually has access to the project."""
    role = get_project_role(db, assignee_id, project_id)
    if not role:
        raise HTTPException(status_code=400, detail="Assignee is not a member of this project.")


def _get_project_for_test_case(db: Session, tc_id: int) -> int:
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")
    ws = db.query(Workspace).filter(Workspace.id == tc.workspace_id).first()
    return ws.project_id


def _get_project_for_issue(db: Session, issue_id: int) -> int:
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    tc = db.query(TestCase).filter(TestCase.id == issue.test_case_id).first()
    ws = db.query(Workspace).filter(Workspace.id == tc.workspace_id).first()
    return ws.project_id


# ── TEST CASE ASSIGNMENT ──────────────────────────────────────────────────────

def assign_test_case(db: Session, tc_id: int, assignee_id: int, current_user_id: int) -> TestCase:
    project_id = _get_project_for_test_case(db, tc_id)
    require_project_role(db, current_user_id, project_id, "editor")
    
    _verify_assignee_is_member(db, project_id, assignee_id)
    
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    tc.assignee_id = assignee_id
    tc.assigned_at = datetime.utcnow()
    db.commit()
    db.refresh(tc)
    
    # Get assignee name for label or just use description
    assignee = db.query(User).filter(User.id == assignee_id).first()
    log_activity(
        db=db,
        verb=Verb.ASSIGNED_TEST_CASE,
        entity_type="test_case",
        entity_id=tc.id,
        entity_label=tc.description or tc.test_case_id,
        actor_id=current_user_id,
        project_id=project_id,
        meta={"assignee_name": assignee.name if assignee else "Unknown User"}
    )
    return tc


def unassign_test_case(db: Session, tc_id: int, current_user_id: int) -> TestCase:
    project_id = _get_project_for_test_case(db, tc_id)
    require_project_role(db, current_user_id, project_id, "editor")
    
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    tc.assignee_id = None
    tc.assigned_at = None
    db.commit()
    db.refresh(tc)
    
    log_activity(
        db=db,
        verb=Verb.UNASSIGNED_TEST_CASE,
        entity_type="test_case",
        entity_id=tc.id,
        entity_label=tc.description or tc.test_case_id,
        actor_id=current_user_id,
        project_id=project_id
    )
    return tc


# ── ISSUE ASSIGNMENT ──────────────────────────────────────────────────────────

def assign_issue(db: Session, issue_id: int, assignee_id: int, current_user_id: int) -> Issue:
    project_id = _get_project_for_issue(db, issue_id)
    require_project_role(db, current_user_id, project_id, "editor")
    
    _verify_assignee_is_member(db, project_id, assignee_id)
    
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    issue.assignee_id = assignee_id
    issue.assigned_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)
    
    assignee = db.query(User).filter(User.id == assignee_id).first()
    log_activity(
        db=db,
        verb=Verb.ASSIGNED_ISSUE,
        entity_type="issue",
        entity_id=issue.id,
        entity_label=issue.title,
        actor_id=current_user_id,
        project_id=project_id,
        meta={"assignee_name": assignee.name if assignee else "Unknown User"}
    )
    return issue


def unassign_issue(db: Session, issue_id: int, current_user_id: int) -> Issue:
    project_id = _get_project_for_issue(db, issue_id)
    require_project_role(db, current_user_id, project_id, "editor")
    
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    issue.assignee_id = None
    issue.assigned_at = None
    db.commit()
    db.refresh(issue)
    
    log_activity(
        db=db,
        verb=Verb.UNASSIGNED_ISSUE,
        entity_type="issue",
        entity_id=issue.id,
        entity_label=issue.title,
        actor_id=current_user_id,
        project_id=project_id
    )
    return issue


# ── MY WORK QUERY ─────────────────────────────────────────────────────────────

def get_my_assignments(db: Session, user_id: int) -> dict:
    """
    Returns all test cases and issues assigned to the user,
    across all projects they still have access to.
    """
    
    # Test cases
    assigned_tcs = (
        db.query(TestCase, Workspace, Project)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .join(Project, Project.id == Workspace.project_id)
        .filter(TestCase.assignee_id == user_id)
        .all()
    )
    
    # Issues
    assigned_issues = (
        db.query(Issue, TestCase, Workspace, Project)
        .join(TestCase, TestCase.id == Issue.test_case_id)
        .join(Workspace, Workspace.id == TestCase.workspace_id)
        .join(Project, Project.id == Workspace.project_id)
        .filter(Issue.assignee_id == user_id)
        .all()
    )
    
    # We must filter out items where the user has lost project access
    # (e.g. they were removed from the project, but the assignee_id remains).
    
    tc_results = []
    for tc, ws, proj in assigned_tcs:
        if get_project_role(db, user_id, proj.id):
            tc_results.append({
                "id": tc.id,
                "test_case_id": tc.test_case_id,
                "description": tc.description,
                "status": tc.status,
                "priority": tc.priority,
                "assigned_at": tc.assigned_at,
                "project": {"id": proj.id, "name": proj.name},
                "workspace": {"id": ws.id, "name": ws.name}
            })
            
    issue_results = []
    for issue, tc, ws, proj in assigned_issues:
        if get_project_role(db, user_id, proj.id):
            issue_results.append({
                "id": issue.id,
                "bug_id": issue.bug_id,
                "title": issue.title,
                "status": issue.status,
                "severity": issue.severity,
                "assigned_at": issue.assigned_at,
                "project": {"id": proj.id, "name": proj.name},
                "workspace": {"id": ws.id, "name": ws.name},
                "test_case_id": tc.test_case_id,
            })
            
    return {
        "test_cases": tc_results,
        "issues": issue_results
    }
