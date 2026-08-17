"""Phase 1 — Collaboration Foundation: organizations, teams, members

Revision ID: c1a2b3d4e5f6
Revises: b9c0d1e2f3a4
Create Date: 2026-06-27

This migration is fully additive:
  - All new tables have their own primary keys and foreign-key constraints.
  - The single change to an existing table (projects.organization_id) is a
    nullable column with a server default of NULL, so no existing row is
    affected.
  - Downgrade restores the schema to its pre-Phase-1 state.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "c1a2b3d4e5f6"
down_revision = "200dafa3286c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── organizations ────────────────────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.String(512), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    # ── organization_members ─────────────────────────────────────────────────
    op.create_table(
        "organization_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )
    op.create_index("ix_organization_members_org_id", "organization_members", ["organization_id"])
    op.create_index("ix_organization_members_user_id", "organization_members", ["user_id"])

    # ── teams ────────────────────────────────────────────────────────────────
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_team_org_name"),
    )
    op.create_index("ix_teams_organization_id", "teams", ["organization_id"])

    # ── team_members ─────────────────────────────────────────────────────────
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("added_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )
    op.create_index("ix_team_members_team_id", "team_members", ["team_id"])
    op.create_index("ix_team_members_user_id", "team_members", ["user_id"])

    # ── projects.organization_id  (additive, nullable) ───────────────────────
    op.add_column(
        "projects",
        sa.Column("organization_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_projects_organization_id",
        "projects",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_projects_organization_id", "projects", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_projects_organization_id", table_name="projects")
    op.drop_constraint("fk_projects_organization_id", "projects", type_="foreignkey")
    op.drop_column("projects", "organization_id")

    op.drop_index("ix_team_members_user_id", table_name="team_members")
    op.drop_index("ix_team_members_team_id", table_name="team_members")
    op.drop_table("team_members")

    op.drop_index("ix_teams_organization_id", table_name="teams")
    op.drop_table("teams")

    op.drop_index("ix_organization_members_user_id", table_name="organization_members")
    op.drop_index("ix_organization_members_org_id", table_name="organization_members")
    op.drop_table("organization_members")

    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
