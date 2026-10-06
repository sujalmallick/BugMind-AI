"""add jobs queue and project documents (Project Knowledge)

Revision ID: c4d8e2a1b7f3
Revises: 7b8c9d0e1f2a
Create Date: 2026-10-06 21:00:00.000000

Additive only: three new tables, nothing existing is altered.
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'c4d8e2a1b7f3'
down_revision: Union[str, Sequence[str], None] = '7b8c9d0e1f2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    if context.is_offline_mode():  # `alembic upgrade --sql`: no connection to inspect
        return False
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _has_table('jobs'):
        op.create_table(
            'jobs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('kind', sa.String(length=50), nullable=False),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True),
            sa.Column('payload', sa.JSON(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='3'),
            sa.Column('run_after', sa.DateTime(), nullable=False),
            sa.Column('locked_by', sa.String(length=100), nullable=True),
            sa.Column('locked_until', sa.DateTime(), nullable=True),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('finished_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_jobs_kind', 'jobs', ['kind'])
        op.create_index('ix_jobs_project_id', 'jobs', ['project_id'])
        op.create_index('ix_jobs_status', 'jobs', ['status'])

    if not _has_table('project_documents'):
        op.create_table(
            'project_documents',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('uploaded_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('filename', sa.String(length=255), nullable=False),
            sa.Column('file_type', sa.String(length=10), nullable=False),
            sa.Column('content_type', sa.String(length=100), nullable=False),
            sa.Column('size_bytes', sa.Integer(), nullable=False),
            sa.Column('sha256', sa.String(length=64), nullable=False),
            sa.Column('storage_path', sa.String(length=512), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('error', sa.Text(), nullable=True),
            sa.Column('ai_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('page_count', sa.Integer(), nullable=True),
            sa.Column('char_count', sa.Integer(), nullable=True),
            sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('flagged_chunk_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('processed_at', sa.DateTime(), nullable=True),
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_project_documents_project_id', 'project_documents', ['project_id'])
        op.create_index('ix_project_documents_sha256', 'project_documents', ['sha256'])

    if not _has_table('document_chunks'):
        op.create_table(
            'document_chunks',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('document_id', sa.Integer(),
                      sa.ForeignKey('project_documents.id', ondelete='CASCADE'), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('ordinal', sa.Integer(), nullable=False),
            sa.Column('heading', sa.String(length=255), nullable=True),
            sa.Column('text', sa.Text(), nullable=False),
            sa.Column('token_estimate', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('flagged', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'])
        op.create_index('ix_document_chunks_project_id', 'document_chunks', ['project_id'])


def downgrade() -> None:
    op.drop_table('document_chunks')
    op.drop_table('project_documents')
    op.drop_table('jobs')
