"""add automation environments and scripts (E2E automation page)

Revision ID: f2b5c7d9e013
Revises: e1a4b6c8d902
Create Date: 2026-10-07 18:00:00.000000

Additive only: two new tables.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'f2b5c7d9e013'
down_revision: Union[str, Sequence[str], None] = 'e1a4b6c8d902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    if context.is_offline_mode():  # `alembic upgrade --sql`: no connection to inspect
        return False
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _has_table('automation_environments'):
        op.create_table(
            'automation_environments',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('base_url', sa.String(length=500), nullable=False),
            sa.Column('allowed_domains', sa.JSON(), nullable=False),
            sa.Column('variables', sa.JSON(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=False, server_default=''),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_automation_environments_project_id', 'automation_environments', ['project_id'])

    if not _has_table('automation_scripts'):
        op.create_table(
            'automation_scripts',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('test_case_id', sa.Integer(), sa.ForeignKey('test_cases.id', ondelete='SET NULL'), nullable=True),
            sa.Column('environment_id', sa.Integer(),
                      sa.ForeignKey('automation_environments.id', ondelete='SET NULL'), nullable=True),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('steps', sa.JSON(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
            sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('origin', sa.String(length=20), nullable=False, server_default='manual'),
            sa.Column('generation', sa.JSON(), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('approved_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('approved_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_automation_scripts_project_id', 'automation_scripts', ['project_id'])
        op.create_index('ix_automation_scripts_test_case_id', 'automation_scripts', ['test_case_id'])


def downgrade() -> None:
    op.drop_index('ix_automation_scripts_test_case_id', table_name='automation_scripts')
    op.drop_index('ix_automation_scripts_project_id', table_name='automation_scripts')
    op.drop_table('automation_scripts')
    op.drop_index('ix_automation_environments_project_id', table_name='automation_environments')
    op.drop_table('automation_environments')
