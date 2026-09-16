"""add custom_fields column to test_cases

Revision ID: 7b8c9d0e1f2a
Revises: 5a7a9418a04e
Create Date: 2026-09-17 02:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b8c9d0e1f2a'
down_revision: Union[str, Sequence[str], None] = '5a7a9418a04e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('test_cases')]
    if 'custom_fields' not in columns:
        op.add_column(
            'test_cases',
            sa.Column('custom_fields', sa.JSON(), server_default='{}', nullable=False)
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('test_cases')]
    if 'custom_fields' in columns:
        op.drop_column('test_cases', 'custom_fields')
