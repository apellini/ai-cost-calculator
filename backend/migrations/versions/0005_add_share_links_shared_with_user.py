"""add shared_with_user_id to share_links

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add shared_with_user_id column to share_links
    op.add_column(
        "share_links",
        sa.Column("shared_with_user_id", sa.Integer(), nullable=True)
    )

    # Add foreign key constraint
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE constraint_name = 'share_links_shared_with_user_id_fkey'
            ) THEN
                ALTER TABLE share_links
                    ADD CONSTRAINT share_links_shared_with_user_id_fkey
                    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$
    """))


def downgrade() -> None:
    # Drop foreign key
    op.drop_constraint(
        "share_links_shared_with_user_id_fkey",
        "share_links",
        type_="foreignkey"
    )

    # Drop column
    op.drop_column("share_links", "shared_with_user_id")
