from pydantic import BaseModel


class AnalysisUpdate(BaseModel):
    result: dict