"""merge heads: provider_keys and profile_columns

Revision ID: b9c0d1e2f3a4
Revises: a1b2c3d4e5f6, a4f2e1c8b3d7
Create Date: 2026-06-27 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b9c0d1e2f3a4'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'a4f2e1c8b3d7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
