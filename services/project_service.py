from datetime import datetime

from sqlalchemy.orm import Session
from database.models.project import Project
from database.models.analysis import Analysis
from database.models.test_case import TestCase
from database.models.workspace import Workspace
from fastapi import HTTPException
from sqlalchemy import func
def create_project(
    db: Session,
    name: str,
    description: str,
    owner_id: int,
) -> Project:
    existing = db.query(Project).filter(
        Project.owner_id == owner_id,
        func.lower(func.trim(Project.name)) == name.strip().lower()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Project with this name already exists")


    project = Project(
        name=name,
        description=description,
        owner_id=owner_id,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    workspace = Workspace(
        project_id=project.id,
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return project

def get_all_projects(
    db: Session,
    owner_id: int,
):
    projects = (
    db.query(Project)
    .filter(Project.owner_id == owner_id)
    .all()
)

    result = []

    for project in projects:

        workspace = project.workspace

        module_count = 0
        test_case_count = 0

        if workspace:

            test_case_count = len(
                workspace.test_cases
            )

            if (
                workspace.analysis
                and workspace.analysis.result
            ):
                module_count = len(
                    workspace.analysis.result.get(
                        "confirmedModules",
                        [],
                    )
                )

        result.append(
            {
                "id": project.id,
                "owner_id": project.owner_id,
                "name": project.name,
                "description": project.description,
                "status": project.status,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "module_count": module_count,
                "test_case_count": test_case_count,
            }
        )

    return result

def get_project_by_id(
    db: Session,
    project_id: int,
    owner_id: int,
    
):
    return (
        db.query(Project)
        .filter(
    Project.id == project_id,
    Project.owner_id == owner_id,
)
        .first()
    )

def update_project(
    db: Session,
    project_id: int,
    owner_id: int,
    name: str,
    description: str,
    status: str,
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

    project.name = name
    project.description = description
    project.status = status
    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project

def delete_project(
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

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}


def touch_project(
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

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project