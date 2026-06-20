from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.project import (
    WorkspaceResponse,
    WorkspaceUpdate,
)
from services.workspace_service import (
    get_workspace,
    update_workspace,
)
from sqlalchemy.orm import Session
from schemas.project import WorkspaceResponse
from database.session import get_db
from services.workspace_service import get_workspace

router = APIRouter(
    prefix="/workspaces",
    tags=["Workspaces"],
)

@router.put(
    "/{project_id}",
    response_model=WorkspaceResponse,
)
def update_workspace_by_project(
    project_id: int,
    workspace: WorkspaceUpdate,
    db: Session = Depends(get_db),
):
    return update_workspace(
        db=db,
        project_id=project_id,
        workflow=workspace.workflow,
        observed_steps=workspace.observed_steps,
        platform=workspace.platform,
        os_version=workspace.os_version,
        build=workspace.build,
        device=workspace.device,
    )

@router.get("/{project_id}", response_model=WorkspaceResponse,)
def get_workspace_by_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    return get_workspace(
        db=db,
        project_id=project_id,
    )