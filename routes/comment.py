from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from database.session import get_db
from database.models.user import User
from auth.dependencies import get_current_user
from schemas.comment import CommentCreate, CommentUpdate, CommentResponse, ReactionCreate
from services import comment_service

router = APIRouter(prefix="/comments", tags=["Comments"])

@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return comment_service.create_comment(db, data, current_user.id)

@router.get("/", response_model=List[CommentResponse])
def get_comments(
    entity_type: str = Query(..., description="'test_case' or 'issue'"),
    entity_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return comment_service.get_comments(db, entity_type, entity_id, current_user.id)

@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: int,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return comment_service.update_comment(db, comment_id, current_user.id, data)

@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment_service.delete_comment(db, comment_id, current_user.id)
    return None

@router.post("/{comment_id}/reactions", status_code=status.HTTP_204_NO_CONTENT)
def add_reaction(
    comment_id: int,
    data: ReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment_service.add_reaction(db, comment_id, current_user.id, data.emoji)
    return None

@router.delete("/{comment_id}/reactions/{emoji}", status_code=status.HTTP_204_NO_CONTENT)
def remove_reaction(
    comment_id: int,
    emoji: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment_service.remove_reaction(db, comment_id, current_user.id, emoji)
    return None
