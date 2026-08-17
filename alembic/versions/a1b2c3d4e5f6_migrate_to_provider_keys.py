"""migrate encrypted_api_key to provider_keys JSON

Revision ID: a1b2c3d4e5f6
Revises: de82b250059f
Create Date: 2026-06-27 10:44:00.000000

"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'de82b250059f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add provider_keys JSON column (nullable so existing rows are fine)
    op.add_column(
        'user_ai_settings',
        sa.Column('provider_keys', sa.JSON(), nullable=True)
    )

    # 2. Migrate existing encrypted_api_key → provider_keys[provider]
    conn = op.get_bind()
    rows = conn.execute(
        text("SELECT id, provider, encrypted_api_key FROM user_ai_settings WHERE encrypted_api_key IS NOT NULL")
    ).fetchall()

    for row in rows:
        migrated = {row.provider: {"encrypted_key": row.encrypted_api_key}}
        conn.execute(
            text("UPDATE user_ai_settings SET provider_keys = :pk WHERE id = :id"),
            {"pk": json.dumps(migrated), "id": row.id},
        )

    # 3. Drop the old single-key column
    op.drop_column('user_ai_settings', 'encrypted_api_key')


def downgrade() -> None:
    # Re-add the old column
    op.add_column(
        'user_ai_settings',
        sa.Column('encrypted_api_key', sa.String(length=5000), nullable=True)
    )

    # Best-effort: copy back the active provider's key
    conn = op.get_bind()
    rows = conn.execute(
        text("SELECT id, provider, provider_keys FROM user_ai_settings WHERE provider_keys IS NOT NULL")
    ).fetchall()

    for row in rows:
        keys = row.provider_keys or {}
        entry = keys.get(row.provider, {})
        enc_key = entry.get("encrypted_key")
        if enc_key:
            conn.execute(
                text("UPDATE user_ai_settings SET encrypted_api_key = :ek WHERE id = :id"),
                {"ek": enc_key, "id": row.id},
            )

    op.drop_column('user_ai_settings', 'provider_keys')
