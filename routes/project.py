from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from schemas.project import (
    ProjectCreate,
    ProjectUpdate,
)
from services.project_service import (
    create_project,
    get_all_projects,
    get_project_by_id,
    update_project,
    delete_project,
    touch_project,
)
router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


@router.post("/")
def create_new_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_project(
        db=db,
        name=project.name,
        description=project.description,
        owner_id=current_user.id,  # Temporary until authentication is added
    )


@router.get("/")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_all_projects(
        db,
        current_user.id,
    )


@router.get("/{project_id}")
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_project_by_id(
        db,
        project_id,
        current_user.id,
    )


@router.put("/{project_id}")
def update_existing_project(
    project_id: int,
    project: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_project(
        db=db,
        project_id=project_id,
        name=project.name,
        description=project.description,
        status=project.status,
        owner_id=current_user.id,
    )


@router.delete("/{project_id}")
def delete_existing_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_project(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
    )


@router.put("/{project_id}/touch")
def touch_existing_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return touch_project(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
    )

from pydantic import BaseModel
class ProjectMemberAdd(BaseModel):
    user_id: int
    role: str = "viewer"

class ProjectTeamAdd(BaseModel):
    team_id: int
    role: str = "viewer"

from services.project_sharing_service import (
    add_project_member,
    remove_project_member,
    list_project_members,
    add_team_to_project,
    remove_team_from_project,
    list_project_teams,
)

@router.get("/{project_id}/members")
def get_project_members_route(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_project_members(db, project_id, current_user.id)


@router.post("/{project_id}/members")
def add_project_member_route(
    project_id: int,
    body: ProjectMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return add_project_member(db, project_id, body.user_id, body.role, current_user.id)


@router.delete("/{project_id}/members/{user_id}")
def remove_project_member_route(
    project_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    remove_project_member(db, project_id, user_id, current_user.id)
    return {"message": "Member removed."}


@router.get("/{project_id}/teams")
def get_project_teams_route(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_project_teams(db, project_id, current_user.id)


@router.post("/{project_id}/teams")
def add_project_team_route(
    project_id: int,
    body: ProjectTeamAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return add_team_to_project(db, project_id, body.team_id, body.role, current_user.id)


@router.delete("/{project_id}/teams/{team_id}")
def remove_project_team_route(
    project_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    remove_team_from_project(db, project_id, team_id, current_user.id)
    return {"message": "Team removed."}