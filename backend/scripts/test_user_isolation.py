"""v0.4 数据隔离测试(手写 smoke,不依赖 pytest)

场景:
  1. owner(user_id=1)登录拿 token
  2. 生成一个邀请码 → 注册 bob(user_id=2)
  3. bob 登录拿 token
  4. bob 用自己的 token 尝试访问/修改 owner 的资源:
     - GET /plan/{owner_plan_id}             → 应 404
     - PATCH /plan/{owner_plan_id}/phase/0   → 应 404
     - POST /feedback 改 owner 的 task_id    → 应 404
     - 自己 GET /plan/active                 → 应 null
     - 自己 GET /today                       → 应 400 无 goal(新用户)

期望:所有越界访问返回 404/400,都不成功。
"""
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import json
import secrets
import urllib.error  # noqa: E402
import urllib.request  # noqa: E402

BASE = "http://127.0.0.1:8000"


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode("utf-8") if body else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except json.JSONDecodeError:
            return e.code, {}


class TestFail(Exception):
    pass


def assert_eq(actual, expected, label: str):
    if actual != expected:
        raise TestFail(f"❌ {label}: 期望 {expected!r}, 实际 {actual!r}")
    print(f"✅ {label}: {actual}")


def main() -> None:
    print("=" * 60)
    print("v0.4 数据隔离测试")
    print("=" * 60)

    # 1. owner 登录
    st, r = call("POST", "/auth/login", {"username": "syz277527", "password": "277527"})
    assert_eq(st, 200, "owner 登录")
    owner_token = r["access_token"]
    owner_id = r["user_id"]

    # 2. 找 owner 的 active plan id
    st, r = call("GET", "/plan/active", token=owner_token)
    assert_eq(st, 200, "owner 查 active plan")
    assert r is not None, "owner 应有 active plan"
    owner_plan_id = r["id"]
    print(f"   owner plan_id = {owner_plan_id}")

    # 3. 找 owner 的一个 task_id
    st, r = call("GET", "/today", token=owner_token)
    assert_eq(st, 200, "owner 查今日任务")
    owner_task_id = r["tasks"][0]["id"] if r["tasks"] else None
    print(f"   owner task_id = {owner_task_id}")

    # 4. 准备一个邀请码给 bob
    from app.db import SessionLocal
    from app.models import InvitationCode, User

    db = SessionLocal()
    try:
        # 清掉可能的 bob 残留(幂等跑)
        bob_old = db.query(User).filter(User.username == "bob_isolation_test").first()
        if bob_old:
            # 先删关联的 invitation / task / plan / goal / phase 等,保持一致
            db.query(InvitationCode).filter(
                InvitationCode.used_by_user_id == bob_old.id
            ).update({"status": "unused", "used_by_user_id": None, "used_at": None})
            # 用 cascade 删 user 会级联删 goal→phase,task 没级联要手动
            from app.models import Goal, LearningPlan, Phase, Task, Event
            db.query(Event).filter(Event.user_id == bob_old.id).delete()
            db.query(Task).filter(Task.user_id == bob_old.id).delete()
            db.query(LearningPlan).filter(LearningPlan.user_id == bob_old.id).delete()
            for g in db.query(Goal).filter(Goal.user_id == bob_old.id).all():
                db.query(Phase).filter(Phase.goal_id == g.id).delete()
            db.query(Goal).filter(Goal.user_id == bob_old.id).delete()
            db.delete(bob_old)
            db.commit()

        code = f"ISO-{secrets.token_hex(4).upper()}"
        inv = InvitationCode(code=code, status="unused", note="isolation test")
        db.add(inv)
        db.commit()
        print(f"   邀请码 = {code}")
    finally:
        db.close()

    # 5. 注册 bob
    st, r = call(
        "POST",
        "/auth/register",
        {"username": "bob_isolation_test", "password": "bob123456", "invitation_code": code},
    )
    assert_eq(st, 200, "bob 注册")
    bob_token = r["access_token"]
    bob_id = r["user_id"]
    assert bob_id != owner_id, "bob 的 user_id 必须与 owner 不同"
    print(f"   bob_id = {bob_id} (owner_id={owner_id})")

    # 6. 关键隔离测试 —— bob 越界访问 owner 资源
    print("\n[ 隔离测试 ]")

    # 6a. bob 查 owner plan → 404
    st, _ = call("GET", f"/plan/{owner_plan_id}", token=bob_token)
    assert_eq(st, 404, f"bob 读 owner plan[{owner_plan_id}] 必须 404")

    # 6b. bob 改 owner phase → 404
    st, _ = call(
        "PATCH",
        f"/plan/{owner_plan_id}/phase/0",
        {"name": "HACKED BY BOB"},
        token=bob_token,
    )
    assert_eq(st, 404, f"bob PATCH owner plan/phase 必须 404")

    # 6c. bob 改 owner habits → 404
    st, _ = call(
        "PATCH",
        f"/plan/{owner_plan_id}/habits",
        {"habits": []},
        token=bob_token,
    )
    assert_eq(st, 404, f"bob PATCH owner habits 必须 404")

    # 6d. bob 改 owner principles → 404
    st, _ = call(
        "PATCH",
        f"/plan/{owner_plan_id}/principles",
        {"principles": ["HACKED"]},
        token=bob_token,
    )
    assert_eq(st, 404, f"bob PATCH owner principles 必须 404")

    # 6e. bob 激活 owner plan → 404
    st, _ = call(
        "POST",
        f"/plan/{owner_plan_id}/activate",
        token=bob_token,
    )
    assert_eq(st, 404, f"bob activate owner plan 必须 404")

    # 6f. bob 给 owner task 提交 feedback → 404
    if owner_task_id is not None:
        st, _ = call(
            "POST",
            "/feedback",
            {"task_id": owner_task_id, "status": "done", "feeling": 5},
            token=bob_token,
        )
        assert_eq(st, 404, f"bob feedback owner task 必须 404")

    # 7. bob 自己的视图:没 plan、没 goal
    st, r = call("GET", "/plan/active", token=bob_token)
    assert_eq(st, 200, "bob 查自己 active plan (应为 null)")
    assert r is None, f"bob 不应有 plan,实际:{r}"

    st, _ = call("GET", "/today", token=bob_token)
    assert_eq(st, 400, "bob 查 today 应 400(无 goal)")

    st, _ = call("GET", "/progress", token=bob_token)
    assert_eq(st, 400, "bob 查 progress 应 400(无 goal)")

    # 8. 无 token 访问
    st, _ = call("GET", "/today")
    assert_eq(st, 401, "无 token 访问 today 必须 401")

    st, _ = call("GET", "/plan/active")
    assert_eq(st, 401, "无 token 访问 plan/active 必须 401")

    # 9. 伪造 token
    st, _ = call("GET", "/auth/me", token="invalid.jwt.token")
    assert_eq(st, 401, "伪造 token 必须 401")

    # 10. 验证 owner 的数据没被 bob 污染
    st, r = call("GET", f"/plan/{owner_plan_id}", token=owner_token)
    assert_eq(st, 200, "owner 自己读 plan 还能成功")
    assert r["phases_data"][0]["name"] != "HACKED BY BOB", "owner 的 phase 被 bob 污染了!"
    print(f"   owner phase[0].name = {r['phases_data'][0]['name']} (未被污染)")

    print("\n" + "=" * 60)
    print("✅ 全部 14 个隔离检查通过")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except TestFail as e:
        print(f"\n{e}")
        sys.exit(1)
