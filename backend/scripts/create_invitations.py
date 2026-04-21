"""生成邀请码脚本(v0.4)

用法:
  cd backend
  python scripts/create_invitations.py --count 10 --note "W1 测试"
  python scripts/create_invitations.py --count 1 --note "给张三" --prefix CCO
"""
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import argparse  # noqa: E402
import secrets  # noqa: E402
import string  # noqa: E402
from datetime import datetime  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import InvitationCode  # noqa: E402

ALPHABET = string.ascii_uppercase + string.digits  # 去掉易混淆的小写


def gen_code(prefix: str = "CCO") -> str:
    """CCO-XXXX-XXXX 格式,9 位随机"""
    body = "".join(secrets.choice(ALPHABET) for _ in range(9))
    return f"{prefix}-{body[:4]}-{body[4:]}"


def main(count: int, note: str | None, prefix: str) -> None:
    db = SessionLocal()
    created: list[str] = []
    try:
        for _ in range(count):
            # 极小概率撞码,重试 5 次
            for _attempt in range(5):
                code = gen_code(prefix)
                if not db.query(InvitationCode).filter_by(code=code).first():
                    break
            inv = InvitationCode(code=code, status="unused", note=note)
            db.add(inv)
            created.append(code)
        db.commit()

        print(f"[ok] 生成 {len(created)} 个邀请码 (note={note or '-'}):")
        for c in created:
            print(f"  {c}")

        print("")
        print(f"时间: {datetime.now():%Y-%m-%d %H:%M}")
        print("分发给测试用户,他们在注册页填入即可注册账号。")
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=1, help="要生成几个")
    ap.add_argument("--note", type=str, default=None, help="备注,比如给谁")
    ap.add_argument("--prefix", type=str, default="CCO", help="码前缀(≤8 字符)")
    args = ap.parse_args()
    if len(args.prefix) > 8:
        print("[err] prefix 太长 (>8)")
        sys.exit(1)
    main(args.count, args.note, args.prefix)
