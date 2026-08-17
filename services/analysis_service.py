from sqlalchemy.orm import Session
from auth.permissions import require_project_role
from database.models.analysis import Analysis
from database.models.project import Project
from database.models.workspace import Workspace


def save_analysis(
    db: Session,
    project_id: int,
    owner_id: int,
    result: dict,
):
    require_project_role(db, owner_id, project_id, "editor")

    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.project_id == project_id
        )
        .first()
    )

    if not workspace:
        return None

    analysis = (
        db.query(Analysis)
        .filter(
            Analysis.workspace_id == workspace.id
        )
        .first()
    )

    if analysis:
        analysis.result = result

    else:
        analysis = Analysis(
            workspace_id=workspace.id,
            result=result,
        )
        db.add(analysis)

    db.commit()
    db.refresh(analysis)

    return analysis


def get_analysis(
    db: Session,
    project_id: int,
    owner_id: int,
):
    require_project_role(db, owner_id, project_id, "viewer")

    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.project_id == project_id
        )
        .first()
    )

    if not workspace:
        return None

    return (
        db.query(Analysis)
        .filter(
            Analysis.workspace_id == workspace.id
        )
        .first()
    )