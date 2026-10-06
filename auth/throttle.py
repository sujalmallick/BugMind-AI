"""
auth/throttle.py — per-account attempt limits.

IP-based rate limits don't stop distributed password guessing against one
account (or flooding one inbox with reset emails), and behind a shared proxy
IP they can't tell users apart. These counters are keyed on the account email.

State is in-memory per worker, so the effective limit is multiplied by the
number of workers; move to Redis when running several instances.
"""

import hashlib
import threading
import time
from collections import deque


class AttemptLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(identity: str) -> str:
        # Don't keep raw emails in memory longer than needed.
        return hashlib.sha256(identity.strip().lower().encode()).hexdigest()

    def _prune(self, bucket: deque, now: float) -> None:
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()

    def is_blocked(self, identity: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._attempts.get(self._key(identity))
            if not bucket:
                return False
            self._prune(bucket, now)
            return len(bucket) >= self.max_attempts

    def record(self, identity: str) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._attempts.setdefault(self._key(identity), deque())
            self._prune(bucket, now)
            bucket.append(now)
            if len(self._attempts) > 50_000:  # bound memory under attack
                self._attempts.clear()

    def reset(self, identity: str) -> None:
        with self._lock:
            self._attempts.pop(self._key(identity), None)


# 10 failed logins per account per 15 minutes.
failed_logins = AttemptLimiter(max_attempts=10, window_seconds=15 * 60)
# 3 password-reset emails per account per hour.
password_reset_requests = AttemptLimiter(max_attempts=3, window_seconds=60 * 60)
