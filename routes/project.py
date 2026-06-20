from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
    db: Session = Depends(get_db),
):
    return create_project(
        db=db,
        name=project.name,
        description=project.description,
        owner_id=1,  # Temporary until authentication is added
    )

@router.get("/")
def list_projects(
    db: Session = Depends(get_db),
):
    return get_all_projects(db)

@router.get("/{project_id}")
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    return get_project_by_id(
        db,
        project_id,
    )

@router.put("/{project_id}")
def update_existing_project(
    project_id: int,
    project: ProjectUpdate,
    db: Session = Depends(get_db),
):
    return update_project(
        db=db,
        project_id=project_id,
        name=project.name,
        description=project.description,
        status=project.status,
    )

@router.delete("/{project_id}")
def delete_existing_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    return delete_project(
        db=db,
        project_id=project_id,
    )

@router.put("/{project_id}/touch")
def touch_existing_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    return touch_project(
        db=db,
        project_id=project_id,
    )