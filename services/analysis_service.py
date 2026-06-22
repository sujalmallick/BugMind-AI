from sqlalchemy.orm import Session

from database.models.analysis import Analysis
from database.models.workspace import Workspace
from database.models.project import Project


def save_analysis(
    db: Session,
    project_id: int,
    owner_id: int,
    result: dict,
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

    return (
        db.query(Analysis)
        .filter(
            Analysis.workspace_id == workspace.id
        )
        .first()
    )