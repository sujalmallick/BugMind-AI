from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from services.analysis_service import (
    save_analysis,
    get_analysis,
)
from schemas.analysis import AnalysisUpdate

router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"],
)
@router.put("/{project_id}")
def update_analysis(
    project_id: int,
    analysis: AnalysisUpdate,
    db: Session = Depends(get_db),
):
    return save_analysis(
        db=db,
        project_id=project_id,
        result=analysis.result,
    )

@router.get("/{project_id}")
def fetch_analysis(
    project_id: int,
    db: Session = Depends(get_db),
):
    return get_analysis(
        db=db,
        project_id=project_id,
    )