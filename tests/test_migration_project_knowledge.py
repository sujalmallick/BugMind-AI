"""The Project Knowledge migration creates exactly what the ORM models expect, and downgrades cleanly."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "c4d8e2a1b7f3_add_jobs_and_project_documents.py"


def load_migration():
    spec = importlib.util.spec_from_file_location("m_c4d8e2a1b7f3", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.context = SimpleNamespace(is_offline_mode=lambda: False)  # outside alembic's env.py
    return module


def test_upgrade_matches_models_and_downgrade_removes_tables(tmp_path):
    import database.models  # noqa: F401
    from database.models.job import Job
    from database.models.project import Project
    from database.models.project_document import DocumentChunk, ProjectDocument
    from database.models.user import User

    engine = sa.create_engine(f"sqlite:///{(tmp_path / 'm.db').as_posix()}")
    User.__table__.create(engine)
    Project.__table__.create(engine)
    migration = load_migration()

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            migration.upgrade()  # idempotent: tables already exist

    inspector = sa.inspect(engine)
    for model in (Job, ProjectDocument, DocumentChunk):
        table = model.__table__
        created = {c["name"] for c in inspector.get_columns(table.name)}
        assert created == {c.name for c in table.columns}, table.name
        created_indexes = {i["name"] for i in inspector.get_indexes(table.name)}
        assert {i.name for i in table.indexes} <= created_indexes, table.name

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.downgrade()
    remaining = set(sa.inspect(engine).get_table_names())
    assert not remaining & {"jobs", "project_documents", "document_chunks"}
