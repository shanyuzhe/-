"""learning_plan.weakness_rank JSON 列(v0.4 Phase C)

Revision ID: 6f30ad4689ed
Revises: e4e0898f6a3d
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f30ad4689ed"
down_revision: Union[str, Sequence[str], None] = "e4e0898f6a3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("learning_plan", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "weakness_rank",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("learning_plan", schema=None) as batch_op:
        batch_op.drop_column("weakness_rank")
