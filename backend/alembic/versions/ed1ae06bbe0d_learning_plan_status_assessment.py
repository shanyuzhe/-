"""learning_plan.latest_assessment + assessment_at (v0.2 S4)

Revision ID: ed1ae06bbe0d
Revises: df706cdc9e22
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ed1ae06bbe0d"
down_revision: Union[str, Sequence[str], None] = "df706cdc9e22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("learning_plan", schema=None) as batch_op:
        batch_op.add_column(sa.Column("latest_assessment", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("assessment_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("learning_plan", schema=None) as batch_op:
        batch_op.drop_column("assessment_at")
        batch_op.drop_column("latest_assessment")
