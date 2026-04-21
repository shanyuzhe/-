"""v0.4: user.username/password_hash + exam_date nullable + invitation_code 表

Revision ID: e4e0898f6a3d
Revises: ed1ae06bbe0d
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4e0898f6a3d"
down_revision: Union[str, Sequence[str], None] = "ed1ae06bbe0d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. user 加 username / password_hash + exam_date 改 nullable
    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.add_column(sa.Column("username", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("password_hash", sa.String(255), nullable=True))
        batch_op.alter_column("exam_date", nullable=True)
        batch_op.create_index("ix_user_username", ["username"], unique=True)

    # 2. invitation_code 新表
    op.create_table(
        "invitation_code",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="unused"),
        sa.Column("used_by_user_id", sa.Integer, sa.ForeignKey("user.id"), nullable=True),
        sa.Column("used_at", sa.DateTime, nullable=True),
        sa.Column("note", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
    )
    op.create_index("ix_invitation_code_code", "invitation_code", ["code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_invitation_code_code", table_name="invitation_code")
    op.drop_table("invitation_code")
    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.drop_index("ix_user_username")
        batch_op.alter_column("exam_date", nullable=False)
        batch_op.drop_column("password_hash")
        batch_op.drop_column("username")
