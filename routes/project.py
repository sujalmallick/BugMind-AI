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
      owner_id=current_user.id, # Temporary until authentication is added
    )

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
    db: Session = Depends(get_db),
):
    current_user: User = Depends(get_current_user),
    return delete_project(
        db=db,
        project_id=project_id,
         owner_id=current_user.id,
    )

@router.put("/{project_id}/touch")
def touch_existing_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    current_user: User = Depends(get_current_user),
    return touch_project(
        db=db,
        project_id=project_id,
         owner_id=current_user.id,
    )