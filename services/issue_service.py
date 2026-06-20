from database.models.workspace import Workspace
from database.models.test_case import TestCase
from database.models.issue import Issue
from sqlalchemy.orm import Session

def save_issue(
    db: Session,
    project_id: int,
    issue: dict,
):
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

    return new_issue

def get_issues(
    db: Session,
    project_id: int,
):
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