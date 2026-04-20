"""v0.1 plus-dialog: drop task.module CheckConstraint

alembic autogenerate 对 CheckConstraint 变更 detect 不全(原生成的 upgrade 是 pass)
手动补 SQL:用 batch_alter_table 重建 task 表去掉 ck_task_module,
其他 constraint(status / feeling_range)和 FK 保留。

Revision ID: 4a4c50d65c00
Revises: 476864d07e48
Create Date: 2026-04-20 21:41:31.425682

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4a4c50d65c00'
down_revision: Union[str, Sequence[str], None] = '476864d07e48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop ck_task_module(module 不再限定雅思四模块,支持泛学科中文命名)"""
    # SQLite 必须用 batch mode 才能 drop constraint(重建表)
    with op.batch_alter_table('task', schema=None) as batch_op:
        batch_op.drop_constraint('ck_task_module', type_='check')


def downgrade() -> None:
    """恢复 ck_task_module(仅允许雅思四模块)"""
    with op.batch_alter_table('task', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_task_module',
            "module IN ('listening', 'speaking', 'reading', 'writing')",
        )
