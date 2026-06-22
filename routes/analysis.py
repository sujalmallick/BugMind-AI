from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database.models.user import User
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save_analysis(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
        result=analysis.result,
    )


@router.get("/{project_id}")
def fetch_analysis(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_analysis(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
    )