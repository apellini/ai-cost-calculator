"""fix cascade fks and add invite_tokens

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fix notifications.project_id — add ON DELETE CASCADE
    op.drop_constraint("notifications_project_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_project_id_fkey",
        "notifications", "projects",
        ["project_id"], ["id"],
        ondelete="CASCADE",
    )

    # Fix share_links.project_id — add ON DELETE CASCADE
    op.drop_constraint("share_links_project_id_fkey", "share_links", type_="foreignkey")
    op.create_foreign_key(
        "share_links_project_id_fkey",
        "share_links", "projects",
        ["project_id"], ["id"],
        ondelete="CASCADE",
    )

    # Create invite_tokens table
    op.create_table(
        "invite_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_invite_tokens_token", "invite_tokens", ["token"])


def downgrade() -> None:
    op.drop_index("ix_invite_tokens_token", table_name="invite_tokens")
    op.drop_table("invite_tokens")

    op.drop_constraint("notifications_project_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_project_id_fkey",
        "notifications", "projects",
        ["project_id"], ["id"],
    )

    op.drop_constraint("share_links_project_id_fkey", "share_links", type_="foreignkey")
    op.create_foreign_key(
        "share_links_project_id_fkey",
        "share_links", "projects",
        ["project_id"], ["id"],
    )
