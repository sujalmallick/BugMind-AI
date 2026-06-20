from pydantic import BaseModel

class IssueCreate(BaseModel):
    issue: dict