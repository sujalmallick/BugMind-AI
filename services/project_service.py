from sqlalchemy.orm import Session

from database.models.project import Project

from database.models.workspace import Workspace
def create_project(
    db: Session,
    name: str,
    description: str,
    owner_id: int,
) -> Project:

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
):
    return db.query(Project).all()

def get_project_by_id(
    db: Session,
    project_id: int,
):
    return (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

def update_project(
    db: Session,
    project_id: int,
    name: str,
    description: str,
    status: str,
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        return None

    project.name = name
    project.description = description
    project.status = status

    db.commit()
    db.refresh(project)

    return project

def delete_project(
    db: Session,
    project_id: int,
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )

    if not project:
        return None

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}