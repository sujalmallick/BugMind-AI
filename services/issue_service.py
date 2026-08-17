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
    import uuid
    from auth.permissions import require_project_role
    require_project_role(db, owner_id, project_id, "editor")

    workspace = (
        db.query(Workspace)
        .filter(Workspace.project_id == project_id)
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Project workspace not found.")

    # Reuse or create the shared IMPORT-DEFAULT test case
    default_tc = (
        db.query(TestCase)
        .filter(
            TestCase.workspace_id == workspace.id,
            TestCase.test_case_id == "IMPORT-DEFAULT",
        )
        .first()
    )
    if not default_tc:
        default_tc = TestCase(
            workspace_id=workspace.id,
            test_case_id="IMPORT-DEFAULT",
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
        db.add(default_tc)
        db.commit()
        db.refresh(default_tc)

    # Auto-generate a unique bug_id if not provided
    raw_bug_id = str(issue.get("bug_id") or "").strip()
    bug_id = raw_bug_id[:30] if raw_bug_id else f"BUG-{uuid.uuid4().hex[:6].upper()}"
    while db.query(Issue).filter(Issue.bug_id == bug_id).first():
        bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"

    title = str(issue.get("title") or "New Reported Bug").strip() or "New Reported Bug"

    new_issue = Issue(
        test_case_id=default_tc.id,
        bug_id=bug_id,
        title=title[:255],
        description=str(issue.get("description") or ""),
        severity=str(issue.get("severity") or "Medium")[:20],
        priority=str(issue.get("priority") or "Medium")[:20],
        status=str(issue.get("status") or "Open")[:20],
        reproduction_steps=str(issue.get("reproduction_steps") or ""),
        expected_result=str(issue.get("expected_result") or ""),
        actual_result=str(issue.get("actual_result") or ""),
        custom_fields=dict(issue.get("custom_fields") or {}),
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
    from auth.permissions import require_project_role
    require_project_role(db, owner_id, project_id, "viewer")

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
            custom_fields={},
        )
        db.add(default_tc)
        db.commit()
        db.refresh(default_tc)

    assigned_bug_ids = set()
    created = []
    for data in data_list:
        raw_bug_id = data.get("bug_id")
        if isinstance(raw_bug_id, str):
            raw_bug_id = raw_bug_id.strip()
        elif raw_bug_id is not None:
            raw_bug_id = str(raw_bug_id).strip()

        # If empty/whitespace, generate a unique bug_id
        if not raw_bug_id:
            bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"
        else:
            bug_id = raw_bug_id[:30]

        # Ensure global uniqueness against both DB and other rows in this batch
        while True:
            if bug_id in assigned_bug_ids:
                bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"[:30]
                continue
            existing = db.query(Issue).filter(Issue.bug_id == bug_id).first()
            if existing:
                bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"[:30]
                continue
            break

        assigned_bug_ids.add(bug_id)

        # Merge notes and any extra fields into custom_fields
        extra_cf = dict(data.get("custom_fields") or {})
        if data.get("notes"):
            extra_cf["notes"] = data["notes"]

        issue = Issue(
            test_case_id=default_tc.id,
            bug_id=bug_id,
            title=str(data.get("title") or "Untitled Issue")[:255],
            description=str(data.get("description") or ""),
            severity=str(data.get("severity") or "Medium")[:20],
            priority=str(data.get("priority") or "Medium")[:20],
            status=str(data.get("status") or "Open")[:20],
            reproduction_steps=str(data.get("reproduction_steps") or ""),
            expected_result=str(data.get("expected_result") or ""),
            actual_result=str(data.get("actual_result") or ""),
            custom_fields=extra_cf,
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


def update_issue(db: Session, project_id: int, issue_id: int, current_user_id: int, data: dict):
    from auth.permissions import require_project_role
    require_project_role(db, current_user_id, project_id, "editor")
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    
    # Fields that should be merged into custom_fields instead of set directly
    cf_only_fields = {"notes", "solved"}
    
    extra_cf = dict(issue.custom_fields or {})
    for key, value in data.items():
        if key in cf_only_fields:
            extra_cf[key] = value
        elif key.startswith("cf_"):
            extra_cf[key[3:]] = value
        elif key == "custom_fields" and isinstance(value, dict):
            extra_cf.update(value)
        elif hasattr(issue, key) and key not in ("id", "test_case_id", "created_at", "updated_at"):
            setattr(issue, key, value)
    
    issue.custom_fields = extra_cf
    db.commit()
    db.refresh(issue)
    return issue


def delete_issue(db: Session, project_id: int, issue_id: int, current_user_id: int):
    from auth.permissions import require_project_role
    require_project_role(db, current_user_id, project_id, "editor")
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    db.delete(issue)
    db.commit()
    return {"success": True}
