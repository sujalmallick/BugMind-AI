"""add automation runs (uploaded Playwright results) and test_cases.automation

Revision ID: a3c6e8f0b124
Revises: f2b5c7d9e013
Create Date: 2026-10-07 22:00:00.000000

Additive only: one new table and one nullable column.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'a3c6e8f0b124'
down_revision: Union[str, Sequence[str], None] = 'f2b5c7d9e013'
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


def upgrade() -> None:
    if not _has_table('automation_runs'):
        op.create_table(
            'automation_runs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('uploaded_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('source', sa.String(length=20), nullable=False, server_default='upload'),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('duration_ms', sa.Integer(), nullable=True),
            sa.Column('totals', sa.JSON(), nullable=False),
            sa.Column('results', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_automation_runs_project_id', 'automation_runs', ['project_id'])
    if not _has_column('test_cases', 'automation'):
        op.add_column('test_cases', sa.Column('automation', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('test_cases', 'automation')
    op.drop_index('ix_automation_runs_project_id', table_name='automation_runs')
    op.drop_table('automation_runs')
