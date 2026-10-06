import os
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from limiter import limiter
from services import automation_service as automation


def _automation_enabled():
    if os.getenv("AUTOMATION_ENABLED", "true").strip().lower() == "false":
        raise HTTPException(status_code=404, detail="Not Found")


router = APIRouter(
    prefix="/projects/{project_id}/automation",
    tags=["Automation"],
    dependencies=[Depends(_automation_enabled)],
)


class Variable(BaseModel):
    name: str = Field(max_length=40)
    value: str | None = Field(default=None, max_length=500)
    secret: bool = False


class EnvironmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=8, max_length=500)
    allowed_domains: list[str] = Field(default_factory=list, max_length=10)
    variables: list[Variable] = Field(default_factory=list, max_length=20)
    notes: str = Field(default="", max_length=2000)


class EnvironmentPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_url: str | None = Field(default=None, min_length=8, max_length=500)
    allowed_domains: list[str] | None = Field(default=None, max_length=10)
    variables: list[Variable] | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=2000)


# Steps are validated by services/automation_actions.py (precise per-step messages).
Steps = list[dict[str, Any]]


class ScriptCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    steps: Steps = Field(default_factory=list, max_length=50)
    environment_id: int | None = None
    test_case_id: int | None = None


class ScriptPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    steps: Steps | None = Field(default=None, max_length=50)
    environment_id: int | None = None
    test_case_id: int | None = None
    status: Literal["draft", "approved"] | None = None


class ScriptGenerate(BaseModel):
    test_case_id: int
    environment_id: int


def _dump(body: BaseModel) -> dict:
    data = body.model_dump(exclude_unset=True)
    if "variables" in data and data["variables"] is not None:
        data["variables"] = [v for v in data["variables"]]
    for key in ("name",):
        if isinstance(data.get(key), str):
            data[key] = data[key].strip()
    return data


# ── Environments ─────────────────────────────────────────────────────────────

@router.get("/environments")
def list_environments(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return automation.list_environments(db, current_user.id, project_id)


@router.post("/environments", status_code=status.HTTP_201_CREATED)
def create_environment(project_id: int, body: EnvironmentCreate, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    return automation.create_environment(db, current_user.id, project_id, _dump(body))


@router.patch("/environments/{env_id}")
def update_environment(project_id: int, env_id: int, body: EnvironmentPatch, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    return automation.update_environment(db, current_user.id, project_id, env_id, _dump(body))


@router.delete("/environments/{env_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(project_id: int, env_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    automation.delete_environment(db, current_user.id, project_id, env_id)


# ── Scripts ──────────────────────────────────────────────────────────────────

@router.get("/scripts")
def list_scripts(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return automation.list_scripts(db, current_user.id, project_id)


@router.post("/scripts", status_code=status.HTTP_201_CREATED)
def create_script(project_id: int, body: ScriptCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    return automation.create_script(db, current_user.id, project_id, _dump(body))


@router.post("/scripts/generate")
@limiter.limit("10/minute")
def generate_script(request: Request, project_id: int, body: ScriptGenerate, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    return automation.generate_script(db, current_user.id, project_id, body.test_case_id, body.environment_id)


@router.get("/scripts/{script_id}")
def get_script(project_id: int, script_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    return automation.get_script(db, current_user.id, project_id, script_id)


@router.patch("/scripts/{script_id}")
def update_script(project_id: int, script_id: int, body: ScriptPatch, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    return automation.update_script(db, current_user.id, project_id, script_id, _dump(body))


@router.delete("/scripts/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_script(project_id: int, script_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    automation.delete_script(db, current_user.id, project_id, script_id)
