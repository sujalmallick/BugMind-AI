from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db

from schemas.project import (
    WorkspaceResponse,
    WorkspaceUpdate,
)

from services.workspace_service import (
    get_workspace,
    update_workspace,
)

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = update_workspace(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
        workflow=workspace.workflow,
        observed_steps=workspace.observed_steps,
        platform=workspace.platform,
        os_version=workspace.os_version,
        build=workspace.build,
        device=workspace.device,
        checklist_progress=workspace.checklist_progress,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return updated


@router.get(
    "/{project_id}",
    response_model=WorkspaceResponse,
)
def get_workspace_by_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = get_workspace(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace