"""
Shared fixtures. Tests are hermetic: the developer's .env is never read, no
network calls are made (LiteLLM's completion() is replaced by a recorder),
and the database is a throwaway SQLite file.
"""

import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Must run before any app module imports dotenv.
import dotenv  # noqa: E402
import dotenv.main  # noqa: E402

dotenv.load_dotenv = lambda *a, **k: False
dotenv.main.load_dotenv = dotenv.load_dotenv

from cryptography.fernet import Fernet  # noqa: E402

_DB_PATH = Path(tempfile.gettempdir()) / f"bugmind_guardrail_tests_{os.getpid()}.db"
os.environ.update({
    "SECRET_KEY": "test-only-secret-key-0123456789abcdef0123456789",
    "ENCRYPTION_KEY": Fernet.generate_key().decode(),
    "DATABASE_URL": f"sqlite:///{_DB_PATH.as_posix()}",
    "LANGCHAIN_TRACING_V2": "false",
    "LANGSMITH_TRACING": "false",
    "LITELLM_LOCAL_MODEL_COST_MAP": "True",
    # Fake developer key so the default provider resolves without a real one.
    "GROQ_API_KEY": "gsk_FAKEtestKEYfor0unit1tests2only3",
})

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_settings(monkeypatch):
    """Each test starts from default guardrail settings."""
    from guardrails import reload_settings

    reload_settings()
    yield
    reload_settings()


@pytest.fixture(autouse=True)
def _fresh_account_throttles():
    """Per-account login/reset counters are process-global; isolate tests."""
    from auth.throttle import failed_logins, password_reset_requests

    for limiter in (failed_logins, password_reset_requests):
        limiter._attempts.clear()
    yield


@pytest.fixture
def set_env(monkeypatch):
    from guardrails import reload_settings

    def _set(**values):
        for k, v in values.items():
            monkeypatch.setenv(k, str(v))
        reload_settings()

    return _set


class FakeLLM:
    """Stands in for litellm.completion(): records every request it receives."""

    def __init__(self):
        self.calls: list[dict] = []
        self.responder = lambda messages: "{}"

    def __call__(self, model=None, api_key=None, messages=None, **kwargs):
        self.calls.append({"model": model, "messages": messages})
        content = self.responder(messages)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    @property
    def all_text(self) -> str:
        return "\n".join(m["content"] for call in self.calls for m in call["messages"])

    def user_prompts(self) -> list[str]:
        return [m["content"] for c in self.calls for m in c["messages"] if m["role"] == "user"]


@pytest.fixture
def fake_llm(monkeypatch):
    import providers.litellm_provider as provider_module

    fake = FakeLLM()
    monkeypatch.setattr(provider_module, "completion", fake)
    return fake


@pytest.fixture
def agent_router():
    """Route fake LLM responses by which agent's prompt is being answered."""

    def build(module=None, checklist=None, test_cases=None, issue=None, workload=None):
        def responder(messages):
            prompt = messages[-1]["content"]
            if "Principal AI Engineer" in prompt:
                return module
            if "exploratory testing checklist" in prompt:
                return checklist
            if "production-ready manual test cases" in prompt:
                return test_cases
            if "root-cause analysis" in prompt:
                return issue
            if "distribute workload" in prompt:
                return workload
            return "{}"
        return responder

    return build


@pytest.fixture
def client(fake_llm):
    from fastapi.testclient import TestClient

    import main
    from auth.dependencies import get_current_user
    from limiter import limiter

    limiter.enabled = False
    main.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=None, email="qa@example.com")
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c
    main.app.dependency_overrides.clear()


@pytest.fixture
def db_session():
    """SQLite session with the full schema (JSONB and now() shimmed for SQLite)."""
    from sqlalchemy import event
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.compiler import compiles

    import database.models  # noqa: F401 — registers all tables
    from database.base import Base
    from database.database import engine
    from database.session import SessionLocal

    @compiles(JSONB, "sqlite")
    def _jsonb(element, compiler, **kw):
        return "JSON"

    def _register_now(dbapi_conn, _record):
        dbapi_conn.create_function("now", 0, lambda: datetime.now(timezone.utc).isoformat(" "))

    if not event.contains(engine, "connect", _register_now):
        event.listen(engine, "connect", _register_now)
    engine.dispose()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
