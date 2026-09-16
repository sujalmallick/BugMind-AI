"""add custom_fields column to issues

Revision ID: 5a7a9418a04e
Revises: 5ef8d1b8dfa6
Create Date: 2026-09-16 20:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a7a9418a04e'
down_revision: Union[str, Sequence[str], None] = '5ef8d1b8dfa6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('issues')]
    if 'custom_fields' not in columns:
        op.add_column(
            'issues',
            sa.Column('custom_fields', sa.JSON(), server_default='{}', nullable=False)
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('issues')]
    if 'custom_fields' in columns:
        op.drop_column('issues', 'custom_fields')
