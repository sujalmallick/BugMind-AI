"""add checklist progress

Revision ID: d58195591e6a
Revises: 93b3260e7048
Create Date: 2026-06-24 00:52:13.640874

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd58195591e6a'
down_revision: Union[str, Sequence[str], None] = '93b3260e7048'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    pass
def downgrade() -> None:
    pass