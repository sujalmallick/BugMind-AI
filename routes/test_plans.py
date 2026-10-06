import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
from database.session import get_db
from limiter import limiter
from services import test_plan_service as plans


def _planning_enabled():
    if os.getenv("TEST_PLANNING_ENABLED", "true").strip().lower() == "false":
        raise HTTPException(status_code=404, detail="Not Found")


router = APIRouter(
    prefix="/projects/{project_id}/test-plans",
    tags=["Test Planning"],
    dependencies=[Depends(_planning_enabled)],
)

class PlanCreate(BaseModel):
    scope: str = Field(min_length=5, max_length=20_000)
    title: str | None = Field(default=None, max_length=200)


class PhasePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    objective: str | None = Field(default=None, max_length=1500)
    scope: str | None = Field(default=None, min_length=1, max_length=3000)
    entry_criteria: str | None = Field(default=None, max_length=1500)
    exit_criteria: str | None = Field(default=None, max_length=1500)
    modules: list[str] | None = Field(default=None, max_length=8)
    risks: list[str] | None = Field(default=None, max_length=8)
    priority: Literal["High", "Medium", "Low"] | None = None
    status: Literal["proposed", "approved", "skipped"] | None = None

    def cleaned(self) -> dict:
        data = self.model_dump(exclude_unset=True)
        for key in ("modules", "risks"):
            if data.get(key) is not None:
                data[key] = [str(v).strip()[:300] for v in data[key] if str(v).strip()]
        for key in ("title", "objective", "scope", "entry_criteria", "exit_criteria"):
            if data.get(key) is not None:
                data[key] = data[key].strip()
        return data


@router.get("")
def list_test_plans(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return plans.list_plans(db, current_user.id, project_id)


@router.post("")
@limiter.limit("5/minute")
def create_test_plan(request: Request, project_id: int, body: PlanCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    return plans.create_plan(db, current_user.id, project_id, body.scope, body.title)


@router.get("/{plan_id}")
def get_test_plan(project_id: int, plan_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    return plans.get_plan(db, current_user.id, project_id, plan_id)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_plan(project_id: int, plan_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    plans.delete_plan(db, current_user.id, project_id, plan_id)


@router.patch("/{plan_id}/phases/{phase_id}")
def update_test_plan_phase(project_id: int, plan_id: int, phase_id: int, body: PhasePatch,
                           db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return plans.update_phase(db, current_user.id, project_id, plan_id, phase_id, body.cleaned())


@router.post("/{plan_id}/phases/{phase_id}/generate")
@limiter.limit("5/minute")
def generate_test_plan_phase(request: Request, project_id: int, plan_id: int, phase_id: int,
                             db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return plans.generate_phase(db, current_user.id, project_id, plan_id, phase_id)
