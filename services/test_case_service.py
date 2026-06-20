from sqlalchemy.orm import Session

from database.models.workspace import Workspace
from database.models.test_case import TestCase


def save_test_cases(
    db: Session,
    project_id: int,
    test_cases: list,
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

    db.query(TestCase).filter(
        TestCase.workspace_id == workspace.id
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
        )

        db.add(test_case)

    db.commit()

    return {"success": True}

def get_test_cases(
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
        db.query(TestCase)
        .filter(
            TestCase.workspace_id == workspace.id
        )
        .all()
    )