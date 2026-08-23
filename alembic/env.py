import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Load .env so local dev works without exporting vars manually
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── DB URL from environment ───────────────────────────────────────────────────
# Priority 1: single DATABASE_URL (used in Azure App Service)
# Priority 2: individual DB_* vars (used in local .env)
_db_url = os.getenv("DATABASE_URL")
if not _db_url:
    _host = os.getenv("DATABASE_HOST", "localhost")
    _port = os.getenv("DATABASE_PORT", "5432")
    _name = os.getenv("DATABASE_NAME", "bugmind")
    _user = os.getenv("DATABASE_USER", "postgres")
    _pass = os.getenv("DATABASE_PASSWORD", "")
    _db_url = f"postgresql+psycopg2://{_user}:{_pass}@{_host}:{_port}/{_name}"
elif _db_url.startswith("postgresql://"):
    # Azure PostgreSQL sometimes gives postgres:// — SQLAlchemy needs psycopg2 dialect
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

config.set_main_option("sqlalchemy.url", _db_url)
# ─────────────────────────────────────────────────────────────────────────────

# add your model's MetaData object here
# for 'autogenerate' support
from database.base import Base
from database import models

target_metadata = Base.metadata
# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
