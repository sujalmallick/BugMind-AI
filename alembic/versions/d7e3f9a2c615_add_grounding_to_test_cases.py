"""add grounding (answer grounding / hallucination check result) to test_cases

Revision ID: d7e3f9a2c615
Revises: c4d8e2a1b7f3
Create Date: 2026-10-06 23:30:00.000000

Additive only: one nullable JSON column.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'd7e3f9a2c615'
down_revision: Union[str, Sequence[str], None] = 'c4d8e2a1b7f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    if context.is_offline_mode():
        return False
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if not _has_column('test_cases', 'grounding'):
        op.add_column('test_cases', sa.Column('grounding', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('test_cases', 'grounding')
