from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func, update, delete
from fastapi import HTTPException
import asyncio

from database.models.notification import Notification
from database.models.notification_preference import NotificationPreference
from schemas.notification import NotificationPreferenceUpdate, NotificationBase

# Default types we support preferences for
PREFERENCE_TYPES = ["mention", "assignment", "invite", "comment", "status_change"]

def get_preferences(db: Session, user_id: int) -> List[NotificationPreference]:
    prefs = db.execute(select(NotificationPreference).where(NotificationPreference.user_id == user_id)).scalars().all()
    
    # If no preferences exist, initialize default ones
    if not prefs:
        for p_type in PREFERENCE_TYPES:
            db.add(NotificationPreference(user_id=user_id, type=p_type, enabled=True, via_email=False))
        db.commit()
        prefs = db.execute(select(NotificationPreference).where(NotificationPreference.user_id == user_id)).scalars().all()

    return prefs

def update_preferences(db: Session, user_id: int, type_str: str, update_data: NotificationPreferenceUpdate) -> NotificationPreference:
    pref = db.execute(
        select(NotificationPreference)
        .where(NotificationPreference.user_id == user_id, NotificationPreference.type == type_str)
    ).scalar_one_or_none()

    if not pref:
        # Create it if it doesn't exist
        pref = NotificationPreference(user_id=user_id, type=type_str)
        db.add(pref)

    if update_data.enabled is not None:
        pref.enabled = update_data.enabled
    if update_data.via_email is not None:
        pref.via_email = update_data.via_email

    db.commit()
    db.refresh(pref)
    return pref

def create_notification(db: Session, user_id: int, actor_id: Optional[int], data: NotificationBase) -> Optional[Notification]:
    # Check preferences first
    if data.type in PREFERENCE_TYPES:
        pref = db.execute(
            select(NotificationPreference)
            .where(NotificationPreference.user_id == user_id, NotificationPreference.type == data.type)
        ).scalar_one_or_none()

        if pref and not pref.enabled:
            return None # User disabled this type

    notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=data.type,
        title=data.title,
        message=data.message,
        action_url=data.action_url,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        project_id=data.project_id,
        org_id=data.org_id
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # --- SSE broadcast ---
    # Broadcast a thin signal (not the notification body) so connected
    # browser tabs update their unread badge instantly.
    new_unread = get_unread_count(db, user_id)
    _broadcast_signal(user_id, new_unread)

    return notif


def _broadcast_signal(user_id: int, unread_count: int) -> None:
    """
    Fire-and-forget: schedule an SSE broadcast from synchronous code.

    The SSE manager lives in async-land (asyncio.Queue). This helper
    bridges the sync SQLAlchemy service layer to the async event loop
    without blocking the request thread.
    """
    from services.sse_manager import sse_manager  # local import avoids circular dep
    payload = {"event": "new_notification", "unread_count": unread_count}
    try:
        loop = asyncio.get_running_loop()
        loop.call_soon_threadsafe(loop.create_task, sse_manager.broadcast(user_id, payload))
    except RuntimeError:
        # No running event loop (e.g. during tests / scripts) — skip silently.
        pass


def get_notifications(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> List[Notification]:
    return db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

def get_unread_count(db: Session, user_id: int) -> int:
    return db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == user_id, Notification.is_read == False)
    ).scalar()

def mark_as_read(db: Session, user_id: int, notification_id: int):
    notif = db.get(Notification, notification_id)
    if not notif or notif.user_id != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    db.commit()

def mark_all_as_read(db: Session, user_id: int):
    db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    db.commit()

def delete_notification(db: Session, user_id: int, notification_id: int):
    notif = db.get(Notification, notification_id)
    if not notif or notif.user_id != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notif)
    db.commit()
