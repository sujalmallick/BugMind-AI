from sqlalchemy.orm import Session

from database.models.project import Project
from database.models.workspace import Workspace
from database.models.test_case import TestCase
from database.models.issue import Issue
from fastapi import HTTPException
from sqlalchemy import func


def save_issue(
    db: Session,
    project_id: int,
    owner_id: int,
    issue: dict,
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == owner_id,
        )
        .first()
    )

    if not project:
        return None

    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.project_id == project_id
        )
        .first()
    )

    if not workspace:
        return None

    test_case = (
        db.query(TestCase)
        .filter(
            TestCase.workspace_id == workspace.id,
            TestCase.test_case_id == issue["test_case_id"],
        )
        .first()
    )

    if not test_case:
        return None

    normalized_title = issue["title"].strip().lower()
    duplicate = (
        db.query(Issue)
        .join(TestCase)
        .filter(
            TestCase.workspace_id == workspace.id,
            func.lower(func.trim(Issue.title)) == normalized_title
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="An issue with this title already exists")

    new_issue = Issue(
        test_case_id=test_case.id,
        bug_id=issue["bug_id"],
        title=issue["title"],
        description=issue["description"],
        severity=issue["severity"],
        priority=issue["priority"],
        status=issue.get("status", "Open"),
        reproduction_steps=issue.get(
            "reproduction_steps",
            "",
        ),
        expected_result=issue.get(
            "expected_result",
            "",
        ),
        actual_result=issue.get(
            "actual_result",
            "",
        ),
    )

    db.add(new_issue)
    db.commit()
    db.refresh(new_issue)

    # Log activity
    from services.activity_service import log_activity, Verb
    log_activity(
        db=db,
        verb=Verb.CREATED_ISSUE,
        entity_type="issue",
        entity_id=new_issue.id,
        entity_label=new_issue.title,
        actor_id=owner_id,
        project_id=project_id,
    )

    return new_issue


def get_issues(
    db: Session,
    project_id: int,
    owner_id: int,
):
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.owner_id == owner_id,
        )
        .first()
    )

    if not project:
        return []

    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.project_id == project_id
        )
        .first()
    )

    if not workspace:
        return []

    return (
        db.query(Issue)
        .join(TestCase)
        .filter(
            TestCase.workspace_id == workspace.id
        )
        .all()
    )


def bulk_import_issues(
    db: Session,
    project_id: int,
    current_user_id: int,
    data_list: list,
):
    from database.models.workspace import Workspace
    from auth.permissions import require_project_role
    from services.activity_service import log_activity, Verb
    import uuid

    require_project_role(db, current_user_id, project_id, "editor")

    workspace = (
        db.query(Workspace)
        .filter(Workspace.project_id == project_id)
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get or create a default test case to attach standalone issues to
    default_tc = (
        db.query(TestCase)
        .filter(TestCase.workspace_id == workspace.id, TestCase.test_case_id == "IMPORT-DEFAULT")
        .first()
    )
    if not default_tc:
        default_tc = TestCase(
            workspace_id=workspace.id,
            test_case_id="IMPORT-DEFAULT",
            description="Auto-created for CSV-imported issues",
            module="Imported",
            category="Functional",
            priority="Medium",
            status="Not Executed",
            preconditions="",
            steps="",
            expected_result="",
            actual_result="",
            notes="",
            is_manual=True,
        )
        db.add(default_tc)
        db.commit()
        db.refresh(default_tc)

    created = []
    for data in data_list:
        # Generate a unique bug_id if not provided
        bug_id = data.get("bug_id") or f"BUG-{uuid.uuid4().hex[:6].upper()}"
        # Check for duplicate bug_id
        existing = db.query(Issue).filter(Issue.bug_id == bug_id).first()
        if existing:
            bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"

        issue = Issue(
            test_case_id=default_tc.id,
            bug_id=bug_id,
            title=data.get("title", "Untitled Issue"),
            description=data.get("description", ""),
            severity=data.get("severity", "Medium"),
            priority=data.get("priority", "Medium"),
            status=data.get("status", "Open"),
            reproduction_steps=data.get("reproduction_steps", ""),
            expected_result=data.get("expected_result", ""),
            actual_result=data.get("actual_result", ""),
        )
        db.add(issue)
        created.append(issue)

    db.commit()
    for issue in created:
        db.refresh(issue)

    log_activity(
        db=db,
        verb=Verb.CREATED_ISSUE,
        entity_type="issue",
        entity_id=workspace.id,
        entity_label=f"Imported {len(created)} issues",
        actor_id=current_user_id,
        project_id=project_id,
    )
    return created