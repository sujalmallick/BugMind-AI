"""add test plans and phases (AI Test Planning), link test cases to a phase

Revision ID: e1a4b6c8d902
Revises: d7e3f9a2c615
Create Date: 2026-10-07 12:00:00.000000

Additive only: two new tables and two nullable columns on test_cases.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'e1a4b6c8d902'
down_revision: Union[str, Sequence[str], None] = 'd7e3f9a2c615'
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
    if not _has_table('test_plans'):
        op.create_table(
            'test_plans',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('scope', sa.Text(), nullable=False),
            sa.Column('summary', sa.Text(), nullable=False, server_default=''),
            sa.Column('details', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_test_plans_project_id', 'test_plans', ['project_id'])

    if not _has_table('test_plan_phases'):
        op.create_table(
            'test_plan_phases',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('plan_id', sa.Integer(), sa.ForeignKey('test_plans.id', ondelete='CASCADE'), nullable=False),
            sa.Column('ordinal', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('objective', sa.Text(), nullable=False, server_default=''),
            sa.Column('scope', sa.Text(), nullable=False, server_default=''),
            sa.Column('modules', sa.JSON(), nullable=False),
            sa.Column('risks', sa.JSON(), nullable=False),
            sa.Column('entry_criteria', sa.Text(), nullable=False, server_default=''),
            sa.Column('exit_criteria', sa.Text(), nullable=False, server_default=''),
            sa.Column('priority', sa.String(length=10), nullable=False, server_default='Medium'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='proposed'),
            sa.Column('grounding', sa.JSON(), nullable=True),
            sa.Column('generation', sa.JSON(), nullable=True),
            sa.Column('approved_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('approved_at', sa.DateTime(), nullable=True),
            sa.Column('generated_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_test_plan_phases_plan_id', 'test_plan_phases', ['plan_id'])

    if not _has_column('test_cases', 'origin'):
        op.add_column('test_cases', sa.Column('origin', sa.String(length=20), nullable=True))
    if not _has_column('test_cases', 'plan_phase_id'):
        op.add_column('test_cases', sa.Column('plan_phase_id', sa.Integer(), nullable=True))
        op.create_index('ix_test_cases_plan_phase_id', 'test_cases', ['plan_phase_id'])
        if not _is_sqlite():  # SQLite can't add a constraint to an existing table
            op.create_foreign_key('fk_test_cases_plan_phase_id', 'test_cases', 'test_plan_phases',
                                  ['plan_phase_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    if not _is_sqlite():
        op.drop_constraint('fk_test_cases_plan_phase_id', 'test_cases', type_='foreignkey')
    op.drop_index('ix_test_cases_plan_phase_id', table_name='test_cases')
    op.drop_column('test_cases', 'plan_phase_id')
    op.drop_column('test_cases', 'origin')
    op.drop_index('ix_test_plan_phases_plan_id', table_name='test_plan_phases')
    op.drop_table('test_plan_phases')
    op.drop_index('ix_test_plans_project_id', table_name='test_plans')
    op.drop_table('test_plans')
