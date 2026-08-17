import re
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from fastapi import HTTPException, status

from database.models.comment import Comment, CommentReaction, Mention
from database.models.user import User
from schemas.comment import CommentCreate, CommentUpdate
from services.notification_service import create_notification
from schemas.notification import NotificationBase

def parse_mentions(db: Session, text: str) -> List[int]:
    """Extracts @usernames from text and returns their user IDs."""
    if not text:
        return []
    
    # Match @ followed by valid username characters
    usernames = re.findall(r'@([a-zA-Z0-9_.-]+)', text)
    if not usernames:
        return []
    
    # Query database for these usernames
    users = db.execute(select(User.id).where(User.username.in_(usernames))).scalars().all()
    return list(set(users))

def _verify_entity_project_access(db: Session, entity_type: str, entity_id: int, user_id: int, min_role: str = "viewer"):
    from auth.permissions import require_project_role
    from database.models.test_case import TestCase
    from database.models.issue import Issue
    from database.models.workspace import Workspace

    project_id = None
    if entity_type == "test_case":
        tc = db.query(TestCase).filter(TestCase.id == entity_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="Test case not found")
        ws = db.query(Workspace).filter(Workspace.id == tc.workspace_id).first()
        project_id = ws.project_id if ws else None
    elif entity_type == "issue":
        issue = db.query(Issue).filter(Issue.id == entity_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        tc = db.query(TestCase).filter(TestCase.id == issue.test_case_id).first()
        ws = db.query(Workspace).filter(Workspace.id == tc.workspace_id).first() if tc else None
        project_id = ws.project_id if ws else None
    else:
        raise HTTPException(status_code=400, detail="Invalid entity type")

    if not project_id:
        raise HTTPException(status_code=404, detail="Associated project not found")

    require_project_role(db, user_id, project_id, min_role)
    return project_id

def create_comment(db: Session, comment_data: CommentCreate, author_id: int) -> Comment:
    _verify_entity_project_access(db, comment_data.entity_type, comment_data.entity_id, author_id, "viewer")
    
    # 1. Create the base comment
    new_comment = Comment(
        author_id=author_id,
        entity_type=comment_data.entity_type,
        entity_id=comment_data.entity_id,
        parent_id=comment_data.parent_id,
        body=comment_data.body
    )
    db.add(new_comment)
    db.flush() # flush to get the ID

    # 2. Parse and create mentions
    mentioned_user_ids = parse_mentions(db, comment_data.body)
    for user_id in mentioned_user_ids:
        mention = Mention(comment_id=new_comment.id, mentioned_user_id=user_id)
        db.add(mention)
        if user_id != author_id:
            create_notification(
                db=db,
                user_id=user_id,
                actor_id=author_id,
                data=NotificationBase(
                    type="mention",
                    title="You were mentioned",
                    message="You were mentioned in a comment.",
                    entity_type=comment_data.entity_type,
                    entity_id=comment_data.entity_id,
                )
            )

    db.commit()

    # Re-fetch with eager loads so author/reactions/mentions are all populated
    stmt = (
        select(Comment)
        .where(Comment.id == new_comment.id)
        .options(
            selectinload(Comment.author),
            selectinload(Comment.reactions),
            selectinload(Comment.mentions),
        )
    )
    return db.execute(stmt).scalar_one()

def get_comments(db: Session, entity_type: str, entity_id: int, user_id: int | None = None) -> List[Comment]:
    """Returns top-level comments for an entity (replies are nested via relationship)"""
    if user_id:
        _verify_entity_project_access(db, entity_type, entity_id, user_id, "viewer")

    stmt = (
        select(Comment)
        .where(
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
            Comment.parent_id == None,
            Comment.deleted_at == None
        )
        .options(
            selectinload(Comment.author),
            selectinload(Comment.reactions),
            selectinload(Comment.mentions),
        )
        .order_by(Comment.created_at.asc())
    )
    return db.execute(stmt).scalars().all()

def update_comment(db: Session, comment_id: int, user_id: int, update_data: CommentUpdate) -> Comment:
    comment = db.get(Comment, comment_id)
    if not comment or comment.deleted_at:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment.author_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    
    comment.body = update_data.body
    comment.is_edited = True
    comment.edited_at = datetime.utcnow()
    
    # Re-parse mentions (we could delete old ones and recreate, or just leave old ones alone.
    # Standard practice is to add new mentions if any new ones were added.)
    # For simplicity, we drop existing un-notified mentions and recreate them, 
    # but actually we can just recreate all mentions (they might get notified again if we implement a worker).
    # Let's just drop existing mentions and re-parse.
    db.execute(Mention.__table__.delete().where(Mention.comment_id == comment.id))
    db.flush()
    
    new_mentions = parse_mentions(db, comment.body)
    for m_u_id in new_mentions:
        db.add(Mention(comment_id=comment.id, mentioned_user_id=m_u_id))
        if m_u_id != user_id:
            create_notification(
                db=db,
                user_id=m_u_id,
                actor_id=user_id,
                data=NotificationBase(
                    type="mention",
                    title="You were mentioned",
                    message="You were mentioned in a comment.",
                    entity_type=comment.entity_type,
                    entity_id=comment.entity_id,
                )
            )
    
    db.commit()
    db.refresh(comment)
    return comment

def delete_comment(db: Session, comment_id: int, user_id: int):
    comment = db.get(Comment, comment_id)
    if not comment or comment.deleted_at:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment.author_id != user_id:
        # In a real app, Admins could delete too. For now, just author.
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    comment.deleted_at = datetime.utcnow()
    db.commit()

def add_reaction(db: Session, comment_id: int, user_id: int, emoji: str):
    comment = db.get(Comment, comment_id)
    if not comment or comment.deleted_at:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if reaction exists
    existing = db.execute(
        select(CommentReaction)
        .where(CommentReaction.comment_id == comment_id, CommentReaction.user_id == user_id, CommentReaction.emoji == emoji)
    ).scalar_one_or_none()
    
    if not existing:
        reaction = CommentReaction(comment_id=comment_id, user_id=user_id, emoji=emoji)
        db.add(reaction)
        db.commit()

def remove_reaction(db: Session, comment_id: int, user_id: int, emoji: str):
    reaction = db.execute(
        select(CommentReaction)
        .where(CommentReaction.comment_id == comment_id, CommentReaction.user_id == user_id, CommentReaction.emoji == emoji)
    ).scalar_one_or_none()
    
    if reaction:
        db.delete(reaction)
        db.commit()
