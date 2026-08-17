import asyncio
from typing import Dict, List

class SSEManager:
    """
    In-memory Server-Sent Events connection manager.

    Each connected user gets one or more asyncio.Queue instances
    (one per open browser tab / connection). When a notification
    is created for a user, `broadcast` puts a thin signal onto
    every queue owned by that user.

    NOTE: This implementation works correctly for a single-process
    Uvicorn deployment (the standard dev/small-prod setup).
    For multi-worker or multi-instance deployments, replace the
    in-memory dict with a Redis pub/sub backend.
    """

    def __init__(self):
        # user_id -> list of asyncio.Queue
        self._connections: Dict[int, List[asyncio.Queue]] = {}

    def connect(self, user_id: int) -> asyncio.Queue:
        """Register a new SSE connection for a user and return its queue."""
        q: asyncio.Queue = asyncio.Queue()
        self._connections.setdefault(user_id, []).append(q)
        return q

    def disconnect(self, user_id: int, q: asyncio.Queue) -> None:
        """Remove a queue when a client disconnects."""
        queues = self._connections.get(user_id, [])
        if q in queues:
            queues.remove(q)
        if not queues:
            self._connections.pop(user_id, None)

    async def broadcast(self, user_id: int, payload: dict) -> None:
        """
        Push a thin signal to all open SSE connections for this user.

        The payload should be minimal — enough to tell the client
        to refresh its unread count. Never include the full
        notification object here.

        Example payload: {"event": "new_notification", "unread_count": 3}
        """
        for q in self._connections.get(user_id, []):
            await q.put(payload)


# Singleton shared across the entire application lifetime.
sse_manager = SSEManager()
