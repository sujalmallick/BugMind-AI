"""Background job queue: atomic claims, retries with backoff, permanent failures, lease expiry."""

from datetime import datetime, timedelta

import pytest

from database.models.job import Job


@pytest.fixture
def queue(db_session, monkeypatch):
    import services.jobs as jobs

    monkeypatch.setattr(jobs, "_registry", {})
    calls, failures = [], []

    def handler(db, job):
        calls.append(job.payload)
        outcome = job.payload.get("outcome")
        if outcome == "retry":
            raise RuntimeError("temporary glitch")
        if outcome == "permanent":
            raise jobs.PermanentJobError("unreadable file")

    jobs.register("test.kind", handler, on_final_failure=lambda db, job, exc: failures.append(str(exc)))
    return jobs, db_session, calls, failures


def add(jobs, db, outcome="ok", **kw):
    job = jobs.enqueue(db, "test.kind", {"outcome": outcome}, **kw)
    db.commit()
    return job.id


def test_success(queue):
    jobs, db, calls, _ = queue
    job_id = add(jobs, db)
    assert jobs.run_pending_jobs(db) == 1
    job = db.get(Job, job_id)
    assert (job.status, job.attempts, job.locked_by) == ("succeeded", 1, None)
    assert calls == [{"outcome": "ok"}]


def test_transient_failures_retry_with_backoff_then_give_up(queue):
    jobs, db, calls, failures = queue
    job_id = add(jobs, db, "retry", max_attempts=3)

    jobs.run_pending_jobs(db)
    job = db.get(Job, job_id)
    assert (job.status, job.attempts) == ("queued", 1)
    assert job.run_after > datetime.utcnow() + timedelta(seconds=20)  # backed off
    assert jobs.run_pending_jobs(db) == 0                             # not due yet

    for _ in range(2):
        job.run_after = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
        jobs.run_pending_jobs(db)
        db.expire_all()
        job = db.get(Job, job_id)

    assert (job.status, job.attempts) == ("failed", 3)
    assert failures == ["temporary glitch"]
    assert len(calls) == 3


def test_permanent_failure_skips_retries(queue):
    jobs, db, calls, failures = queue
    job_id = add(jobs, db, "permanent")
    jobs.run_pending_jobs(db)
    job = db.get(Job, job_id)
    assert (job.status, job.attempts) == ("failed", 1)
    assert failures == ["unreadable file"] and len(calls) == 1


def test_a_job_can_only_be_claimed_once(queue):
    jobs, db, _, _ = queue
    add(jobs, db)
    assert jobs.claim_next(db, "worker-a") is not None
    assert jobs.claim_next(db, "worker-b") is None  # held under worker-a's lease


def test_expired_leases_are_reclaimed(queue):
    jobs, db, calls, _ = queue
    job_id = add(jobs, db)
    job = jobs.claim_next(db, "worker-that-died")
    job.locked_until = datetime.utcnow() - timedelta(seconds=1)
    db.commit()

    assert jobs.run_pending_jobs(db, worker_id="worker-b") == 1
    job = db.get(Job, job_id)
    assert (job.status, job.attempts) == ("succeeded", 2)


def test_unknown_kinds_are_left_alone(queue):
    jobs, db, _, _ = queue
    db.add(Job(kind="someone.else", payload={}, status="queued", run_after=datetime.utcnow()))
    db.commit()
    assert jobs.run_pending_jobs(db) == 0


def test_worker_thread_processes_jobs(queue, monkeypatch):
    """The real background thread (as started at app startup) picks up and runs a job."""
    import time

    jobs, db, calls, _ = queue
    monkeypatch.setenv("JOBS_WORKER_ENABLED", "true")
    monkeypatch.setattr(jobs, "POLL_SECONDS", 0.1)
    job_id = add(jobs, db)

    jobs.start_worker()
    try:
        deadline = time.time() + 10
        while time.time() < deadline:
            db.expire_all()
            if db.get(Job, job_id).status == "succeeded":
                break
            time.sleep(0.1)
    finally:
        jobs.stop_worker()
        jobs._worker.join(timeout=5)
    assert db.get(Job, job_id).status == "succeeded"
    assert calls == [{"outcome": "ok"}]


def test_worker_respects_the_disable_flag(monkeypatch):
    import services.jobs as jobs

    monkeypatch.setenv("JOBS_WORKER_ENABLED", "false")
    monkeypatch.setattr(jobs, "_worker", None)
    jobs.start_worker()
    assert jobs._worker is None
