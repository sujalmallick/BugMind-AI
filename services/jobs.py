"""
services/jobs.py — a small database-backed job queue.

enqueue() adds a row. A worker thread in each app process claims jobs with an
atomic conditional UPDATE (safe across gunicorn workers and across Postgres or
SQLite), runs the handler registered for the job's kind, and records the
outcome. Failures retry with exponential backoff up to max_attempts;
PermanentJobError skips the retries. Leases expire, so a job held by a process
that died is picked up again.
"""

import logging
import os
import socket
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable

from sqlalchemy import and_, or_, update
from sqlalchemy.orm import Session

from database.models.job import Job

logger = logging.getLogger("BugMind")

LEASE_SECONDS = 300
POLL_SECONDS = 3.0
BACKOFF_BASE_SECONDS = 30


class PermanentJobError(Exception):
    """Raise from a handler when retrying cannot help. The message is shown to users."""


@dataclass
class _Registration:
    handler: Callable[[Session, Job], None]
    on_final_failure: Callable[[Session, Job, Exception], None] | None


_registry: dict[str, _Registration] = {}
_wake = threading.Event()
_stop = threading.Event()
_worker: threading.Thread | None = None


def register(
    kind: str,
    handler: Callable[[Session, Job], None],
    on_final_failure: Callable[[Session, Job, Exception], None] | None = None,
) -> None:
    """Register the handler for a job kind. on_final_failure runs once a job gives up."""
    _registry[kind] = _Registration(handler, on_final_failure)


def enqueue(db: Session, kind: str, payload: dict, project_id: int | None = None, max_attempts: int = 3) -> Job:
    """Add a job to the caller's transaction. It runs once the caller commits."""
    job = Job(kind=kind, payload=payload, project_id=project_id, status="queued",
              max_attempts=max_attempts, run_after=datetime.utcnow())
    db.add(job)
    db.flush()
    _wake.set()
    return job


def _claimable(now: datetime):
    return and_(
        Job.kind.in_(list(_registry)),
        or_(
            and_(Job.status == "queued", Job.run_after <= now),
            and_(Job.status == "running", Job.locked_until < now),  # lease expired: its process died
        ),
    )


def claim_next(db: Session, worker_id: str) -> Job | None:
    """Atomically take the next due job, or None. Only one claimer can win each job."""
    if not _registry:
        return None
    now = datetime.utcnow()
    candidates = (
        db.query(Job.id).filter(_claimable(now)).order_by(Job.run_after, Job.id).limit(5).all()
    )
    for (job_id,) in candidates:
        result = db.execute(
            update(Job)
            .where(Job.id == job_id, _claimable(now))
            .values(status="running", locked_by=worker_id, locked_until=now + timedelta(seconds=LEASE_SECONDS),
                    attempts=Job.attempts + 1, updated_at=now)
            .execution_options(synchronize_session=False)
        )
        db.commit()
        if result.rowcount == 1:
            return db.get(Job, job_id)
    return None


def run_job(db: Session, job: Job) -> None:
    registration = _registry[job.kind]
    job_id, kind = job.id, job.kind
    try:
        if job.attempts > job.max_attempts:  # reclaimed after repeated lease expiry
            raise RuntimeError("Job lease expired too many times")
        registration.handler(db, job)
        job = db.get(Job, job_id)
        job.status, job.finished_at = "succeeded", datetime.utcnow()
        job.locked_by = job.locked_until = None
        job.last_error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.get(Job, job_id)
        job.last_error = str(exc)[:2000]
        job.locked_by = job.locked_until = None
        if isinstance(exc, PermanentJobError) or job.attempts >= job.max_attempts:
            job.status, job.finished_at = "failed", datetime.utcnow()
            logger.warning(f"Job {job_id} ({kind}) failed permanently after {job.attempts} attempt(s): {exc}")
            if registration.on_final_failure:
                try:
                    registration.on_final_failure(db, job, exc)
                except Exception:
                    logger.exception(f"on_final_failure hook for job {job_id} ({kind}) raised")
        else:
            delay = BACKOFF_BASE_SECONDS * 2 ** (job.attempts - 1)
            job.status, job.run_after = "queued", datetime.utcnow() + timedelta(seconds=delay)
            logger.warning(f"Job {job_id} ({kind}) attempt {job.attempts} failed; retrying in {delay}s: {exc}")
        db.commit()


def run_pending_jobs(db: Session, worker_id: str = "inline", limit: int = 100) -> int:
    """Run due jobs until none are left (or `limit`). Returns how many ran."""
    ran = 0
    while ran < limit:
        job = claim_next(db, worker_id)
        if job is None:
            break
        run_job(db, job)
        ran += 1
    return ran


def _worker_loop(worker_id: str) -> None:
    from database.session import SessionLocal

    logger.info(f"Job worker {worker_id} started")
    while not _stop.is_set():
        try:
            with SessionLocal() as db:
                ran = run_pending_jobs(db, worker_id)
        except Exception:
            logger.exception("Job worker loop error")
            ran = 0
        if not ran:
            _wake.wait(POLL_SECONDS)
            _wake.clear()


def start_worker() -> None:
    """Start the in-process worker thread (one per app process). JOBS_WORKER_ENABLED=false disables it."""
    global _worker
    if os.getenv("JOBS_WORKER_ENABLED", "true").strip().lower() == "false":
        return
    if _worker and _worker.is_alive():
        return
    _stop.clear()
    worker_id = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:6]}"
    _worker = threading.Thread(target=_worker_loop, args=(worker_id,), name="bugmind-jobs", daemon=True)
    _worker.start()


def stop_worker() -> None:
    _stop.set()
    _wake.set()
