"""add automation upload tokens (CI uploads results), run token + report hash

Revision ID: b4d7f9a1c235
Revises: a3c6e8f0b124
Create Date: 2026-10-08 10:00:00.000000

Additive only: one new table and two nullable columns on automation_runs.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'b4d7f9a1c235'
down_revision: Union[str, Sequence[str], None] = 'a3c6e8f0b124'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _offline() -> bool:
    return context.is_offline_mode()  # `alembic upgrade --sql`: no connection to inspect


def _has_table(name: str) -> bool:
    return False if _offline() else sa.inspect(op.get_bind()).has_table(name)


def _has_column(table: str, column: str) -> bool:
    if _offline():
        return False
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _is_sqlite() -> bool:
    return op.get_context().dialect.name == "sqlite"


def upgrade() -> None:
    if not _has_table('automation_upload_tokens'):
        op.create_table(
            'automation_upload_tokens',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('name', sa.String(length=60), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('prefix', sa.String(length=16), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('last_used_at', sa.DateTime(), nullable=True),
            sa.Column('revoked_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_automation_upload_tokens_project_id', 'automation_upload_tokens', ['project_id'])
        op.create_index('ix_automation_upload_tokens_token_hash', 'automation_upload_tokens', ['token_hash'],
                        unique=True)
    if not _has_column('automation_runs', 'token_id'):
        op.add_column('automation_runs', sa.Column('token_id', sa.Integer(), nullable=True))
        if not _is_sqlite():  # SQLite can't add a constraint to an existing table
            op.create_foreign_key('fk_automation_runs_token_id', 'automation_runs', 'automation_upload_tokens',
                                  ['token_id'], ['id'], ondelete='SET NULL')
    if not _has_column('automation_runs', 'report_hash'):
        op.add_column('automation_runs', sa.Column('report_hash', sa.String(length=64), nullable=True))
        op.create_index('ix_automation_runs_report_hash', 'automation_runs', ['report_hash'])


def downgrade() -> None:
    op.drop_index('ix_automation_runs_report_hash', table_name='automation_runs')
    op.drop_column('automation_runs', 'report_hash')
    if not _is_sqlite():
        op.drop_constraint('fk_automation_runs_token_id', 'automation_runs', type_='foreignkey')
    op.drop_column('automation_runs', 'token_id')
    op.drop_index('ix_automation_upload_tokens_token_hash', table_name='automation_upload_tokens')
    op.drop_index('ix_automation_upload_tokens_project_id', table_name='automation_upload_tokens')
    op.drop_table('automation_upload_tokens')
