from sqlalchemy.orm import Session
from auth.permissions import require_project_role
from database.models.project import Project
from database.models.workspace import Workspace


def get_workspace(
    db: Session,
    project_id: int,
    owner_id: int,
):
    require_project_role(db, owner_id, project_id, "viewer")

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
    checklist_progress: dict,
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

    workspace.workflow = workflow
    workspace.observed_steps = observed_steps
    workspace.platform = platform
    workspace.os_version = os_version
    workspace.build = build
    workspace.device = device
    workspace.checklist_progress = checklist_progress

    db.commit()
    db.refresh(workspace)

    return workspace