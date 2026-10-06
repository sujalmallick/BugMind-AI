import asyncio
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, user_from_token
from auth.jwt import create_stream_ticket
from database.session import SessionLocal, get_db
from database.models.user import User
from database.models.notification import Notification
from services.sse_manager import CLOSE_STREAM, sse_manager

from schemas.notification import (
    NotificationResponse, 
    NotificationListResponse,
    UnreadCountResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate
)

from services.notification_service import (
    get_notifications,
    get_unread_count,
    mark_as_read,
    mark_all_as_read,
    delete_notification,
    get_preferences,
    update_preferences
)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=NotificationListResponse)
def get_notifications_route(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all notifications for the current user."""
    items = get_notifications(db, current_user.id, limit, offset)
    unread_count = get_unread_count(db, current_user.id)
    return NotificationListResponse(
        total=len(items), # Simplified total
        unread_count=unread_count,
        items=items
    )

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get unread notification count for the current user."""
    return UnreadCountResponse(unread_count=get_unread_count(db, current_user.id))

@router.patch("/read-all", status_code=status.HTTP_200_OK)
def mark_all_as_read_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all unread notifications as read."""
    mark_all_as_read(db, current_user.id)
    return {"detail": "All notifications marked as read."}

@router.patch("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_as_read_route(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    mark_as_read(db, current_user.id, notification_id)
    return {"detail": "Notification marked as read."}

@router.delete("/clear-all", status_code=status.HTTP_200_OK)
def clear_all_notifications_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all notifications for the current user."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).delete()
    db.commit()
    return {"detail": "All notifications cleared."}

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification_route(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a notification."""
    delete_notification(db, current_user.id, notification_id)
    return None

@router.post("/test", status_code=status.HTTP_201_CREATED)
def trigger_test_notification_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """(Development only) Trigger a test notification for the current user via create_notification so SSE fires."""
    import os
    # Disabled unless the environment is explicitly marked as development.
    if os.getenv("ENVIRONMENT", "production").lower() not in ("development", "dev", "local"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Test endpoints are disabled in production.")

    from schemas.notification import NotificationBase
    from services.notification_service import create_notification
    create_notification(
        db,
        user_id=current_user.id,
        actor_id=None,
        data=NotificationBase(
            type="system",
            title="AI Analysis Complete",
            message="Your requested workflow analysis has finished successfully. View the results now.",
            action_url="/projects",
        )
    )
    return {"detail": "Test notification created."}


@router.post("/stream-ticket")
def create_notification_stream_ticket(current_user: User = Depends(get_current_user)):
    """Mint a 60-second ticket that only opens the notification stream."""
    return {"ticket": create_stream_ticket(current_user.id)}


@router.get("/stream")
async def notification_stream(
    ticket: str | None = Query(None, description="Ticket from POST /stream-ticket"),
    token: str | None = Query(None, description="Deprecated: full access token; use ticket"),
):
    """
    Server-Sent Events endpoint for real-time notification signals.

    IMPORTANT — Security note:
      The JWT is passed as a query parameter because the browser's native
      EventSource API does not support custom request headers. This means
      the token may appear in server/proxy logs.

      TODO: Migrate to cookie-based authentication or a fetch()-based
      streaming client (e.g. @microsoft/fetch-event-source) so the token
      can be sent in an Authorization header, eliminating log exposure.
    """
    # --- Authenticate via query-param token (same checks as every other endpoint,
    # including soft-deleted accounts and sessions revoked by a password change) ---
    db = SessionLocal()
    try:
        if ticket:
            user_id = user_from_token(ticket, db, purpose="sse").id
        elif token:
            # Kept for one release so a backend deploy ahead of the frontend
            # doesn't break notifications. Remove once clients send tickets.
            user_id = user_from_token(token, db).id
        else:
            raise HTTPException(status_code=401, detail="Missing stream ticket")
    except HTTPException:
        async def _error():
            yield "data: {\"error\": \"unauthorized\"}\n\n"
        return StreamingResponse(_error(), media_type="text/event-stream", status_code=401)
    finally:
        db.close()

    # --- SSE event generator ---
    async def event_generator():
        q = sse_manager.connect(user_id)
        if q is None:
            yield "data: {\"error\": \"too many connections\"}\n\n"
            return
        try:
            # Send an immediate ping so the client knows the connection is live
            yield f"data: {json.dumps({'event': 'connected', 'user_id': user_id})}\n\n"
            while True:
                try:
                    # Wait for a broadcast signal (timeout keeps connection alive via comment)
                    data = await asyncio.wait_for(q.get(), timeout=25.0)
                    if data is CLOSE_STREAM:
                        break  # superseded by a newer connection from this user
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # SSE keep-alive comment (prevents proxies from closing idle connections)
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.disconnect(user_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering
        },
    )

@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
def get_preferences_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notification preferences for current user."""
    return get_preferences(db, current_user.id)

@router.put("/preferences/{type_str}", response_model=NotificationPreferenceResponse)
def update_preferences_route(
    type_str: str,
    update_data: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update notification preference for current user."""
    return update_preferences(db, current_user.id, type_str, update_data)
