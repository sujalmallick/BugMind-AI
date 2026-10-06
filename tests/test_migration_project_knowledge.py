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


def test_grounding_column_migration(tmp_path):
    from database.models.test_case import TestCase

    spec = importlib.util.spec_from_file_location(
        "m_d7e3f9a2c615", MIGRATION.parent / "d7e3f9a2c615_add_grounding_to_test_cases.py")
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    migration.context = SimpleNamespace(is_offline_mode=lambda: False)

    engine = sa.create_engine(f"sqlite:///{(tmp_path / 'g.db').as_posix()}")
    table = TestCase.__table__
    sa.Table(table.name, sa.MetaData(), *[c.copy() for c in table.columns
                                                     if c.name not in ("grounding", "origin", "plan_phase_id")]).create(engine)

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            migration.upgrade()  # idempotent
    assert "grounding" in {c["name"] for c in sa.inspect(engine).get_columns("test_cases")}

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.downgrade()
    assert "grounding" not in {c["name"] for c in sa.inspect(engine).get_columns("test_cases")}


def test_test_plans_migration(tmp_path):
    """Plans and phases match the models; test_cases gains origin + plan_phase_id; downgrade is clean."""
    from database.models.test_case import TestCase
    from database.models.test_plan import TestPlan, TestPlanPhase
    from database.models.project import Project
    from database.models.user import User
    from database.models.workspace import Workspace

    spec = importlib.util.spec_from_file_location("m_e1a4b6c8d902", MIGRATION.parent / "e1a4b6c8d902_add_test_plans.py")
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    migration.context = SimpleNamespace(is_offline_mode=lambda: False)

    engine = sa.create_engine(f"sqlite:///{(tmp_path / 'p.db').as_posix()}")
    for model in (User, Project, Workspace):
        model.__table__.create(engine)
    table = TestCase.__table__
    sa.Table(table.name, sa.MetaData(), *[c.copy() for c in table.columns
                                          if c.name not in ("origin", "plan_phase_id")]).create(engine)

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            migration.upgrade()  # idempotent

    inspector = sa.inspect(engine)
    for model in (TestPlan, TestPlanPhase):
        created = {c["name"] for c in inspector.get_columns(model.__tablename__)}
        assert created == {c.name for c in model.__table__.columns}, model.__tablename__
    case_columns = {c["name"] for c in inspector.get_columns("test_cases")}
    assert {"origin", "plan_phase_id"} <= case_columns
    assert "ix_test_cases_plan_phase_id" in {i["name"] for i in inspector.get_indexes("test_cases")}

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.downgrade()
    inspector = sa.inspect(engine)
    assert not {"test_plans", "test_plan_phases"} & set(inspector.get_table_names())
    assert not {"origin", "plan_phase_id"} & {c["name"] for c in inspector.get_columns("test_cases")}


def test_automation_migration(tmp_path):
    """Environments and scripts match the models; downgrade removes them."""
    from database.models.automation import AutomationEnvironment, AutomationScript
    from database.models.project import Project
    from database.models.test_case import TestCase
    from database.models.user import User
    from database.models.workspace import Workspace

    spec = importlib.util.spec_from_file_location("m_f2b5c7d9e013", MIGRATION.parent / "f2b5c7d9e013_add_automation.py")
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    migration.context = SimpleNamespace(is_offline_mode=lambda: False)

    engine = sa.create_engine(f"sqlite:///{(tmp_path / 'a.db').as_posix()}")
    for model in (User, Project, Workspace):
        model.__table__.create(engine)
    sa.Table("test_cases", sa.MetaData(), sa.Column("id", sa.Integer, primary_key=True)).create(engine)

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            migration.upgrade()  # idempotent

    inspector = sa.inspect(engine)
    for model in (AutomationEnvironment, AutomationScript):
        created = {c["name"] for c in inspector.get_columns(model.__tablename__)}
        assert created == {c.name for c in model.__table__.columns}, model.__tablename__
        assert {i.name for i in model.__table__.indexes} <= {i["name"] for i in inspector.get_indexes(model.__tablename__)}

    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.downgrade()
    assert not {"automation_environments", "automation_scripts"} & set(sa.inspect(engine).get_table_names())
