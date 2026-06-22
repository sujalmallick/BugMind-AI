from sqlalchemy.orm import Session

from database.models.workspace import Workspace
from database.models.project import Project


def get_workspace(
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

    return (
        db.query(Workspace)
        .filter(Workspace.project_id == project_id)
        .first()
    )


def update_workspace(
    db: Session,
    project_id: int,
    owner_id: int,
    workflow: str,
    observed_steps: str,
    platform: str,
    os_version: str,
    build: str,
    device: str,
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

    workspace.workflow = workflow
    workspace.observed_steps = observed_steps
    workspace.platform = platform
    workspace.os_version = os_version
    workspace.build = build
    workspace.device = device

    db.commit()
    db.refresh(workspace)

    return workspace