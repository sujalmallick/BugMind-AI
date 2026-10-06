import asyncio
from typing import Dict, List, Optional

# Bounds so one account (or a script holding one token) can't exhaust
# file descriptors or memory with streams.
MAX_CONNECTIONS_PER_USER = 5
MAX_CONNECTIONS_TOTAL = 2000
QUEUE_SIZE = 100

# Put on a queue to make its stream end (used when a user exceeds the cap).
CLOSE_STREAM = {"event": "__close__"}

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

    def connect(self, user_id: int) -> Optional[asyncio.Queue]:
        """
        Register a new SSE connection for a user and return its queue, or None
        when the server-wide cap is reached. Past the per-user cap the oldest
        stream is closed, so the newest tab always works.
        """
        queues = self._connections.setdefault(user_id, [])
        if len(queues) >= MAX_CONNECTIONS_PER_USER:
            oldest = queues.pop(0)
            self._close(oldest)
        elif sum(len(v) for v in self._connections.values()) >= MAX_CONNECTIONS_TOTAL:
            if not queues:
                self._connections.pop(user_id, None)
            return None
        q: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_SIZE)
        queues.append(q)
        return q

    @staticmethod
    def _close(q: asyncio.Queue) -> None:
        while not q.empty():
            q.get_nowait()
        q.put_nowait(CLOSE_STREAM)

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
        for q in list(self._connections.get(user_id, [])):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass  # client isn't reading; signals are idempotent counts, so drop


# Singleton shared across the entire application lifetime.
sse_manager = SSEManager()
