from pydantic import BaseModel, Field
from typing import TypedDict


class WorkflowInput(BaseModel):
    workflow: str = Field(
        min_length=5,
        description="Application workflow"
    )

    observed_steps: list[str] | None = None


class WorkflowState(TypedDict):
    workflow: str

    observed_steps: list[str] | None

    modules: dict

    checklist: str

    test_cases: str