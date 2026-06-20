from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str

class ProjectUpdate(BaseModel):
    name: str
    description: str
    status: str


class WorkspaceResponse(BaseModel):
    id: int
    project_id: int

    workflow: str | None = None
    observed_steps: str | None = None

    platform: str | None = None
    os_version: str | None = None
    build: str | None = None
    device: str | None = None

    class Config:
        from_attributes = True


class WorkspaceUpdate(BaseModel):
    workflow: str

    observed_steps: str = ""

    platform: str = ""

    os_version: str = ""

    build: str = ""

    device: str = ""