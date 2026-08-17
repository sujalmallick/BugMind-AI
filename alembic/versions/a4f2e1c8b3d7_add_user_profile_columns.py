"""add user profile columns

Revision ID: a4f2e1c8b3d7
Revises: d58195591e6a
Create Date: 2026-06-27 12:18:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4f2e1c8b3d7'
down_revision: Union[str, Sequence[str], None] = 'd58195591e6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_url', sa.String(512), nullable=True))
    op.add_column('users', sa.Column('credentials_updated_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('deleted_by', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'deleted_by')
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'credentials_updated_at')
    op.drop_column('users', 'avatar_url')
