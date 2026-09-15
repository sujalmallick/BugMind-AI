"""add checklist_progress column to workspaces

Revision ID: 5ef8d1b8dfa6
Revises: 781aea759a7a
Create Date: 2026-09-15 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5ef8d1b8dfa6'
down_revision: Union[str, Sequence[str], None] = '781aea759a7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('workspaces')]
    if 'checklist_progress' not in columns:
        op.add_column(
            'workspaces',
            sa.Column('checklist_progress', sa.JSON(), server_default='{}', nullable=False)
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('workspaces')]
    if 'checklist_progress' in columns:
        op.drop_column('workspaces', 'checklist_progress')
