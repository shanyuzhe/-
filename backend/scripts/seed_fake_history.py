"""40 天假历史数据 seed(v0.2 S1)

用途:
  - 给 V3 生成任务时一份可见的 "40 天真实感" 历史,让复盘规则 / 降量规则真正被触发
  - 所有 task 标 note="__seed_fake",一键清:
      DELETE FROM task WHERE note='__seed_fake';

规则详见 docs/v0.2-test-dataset-and-progress-eval.md。

用法:
  cd backend
  python scripts/seed_fake_history.py                # 新增(已存在则拒绝)
  python scripts/seed_fake_history.py --reset        # 先删旧假数据再生成
"""
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import argparse  # noqa: E402
import random  # noqa: E402
from datetime import date, datetime, time, timedelta  # noqa: E402

from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import Task, User  # noqa: E402

FAKE_NOTE = "__seed_fake"
START = date(2026, 3, 12)
END = date(2026, 4, 20)  # 40 days inclusive

# 模块权重(按 v0.2 文档 408 规划占比)
MODULE_WEIGHTS = [
    ("高数", 30),
    ("数据结构", 15),
    ("组成原理", 15),
    ("翻译", 10),
    ("词汇", 10),
    ("阅读", 10),
    ("其他", 10),
]

# 每模块 8-10 条模板(title 允许 {n} 占位符)
TEMPLATES: dict[str, list[tuple[str, str]]] = {
    "高数": [
        ("武忠祥基础班 ep{n}", "听完第 {n} 讲 + 配套讲义做 15-20 题"),
        ("高数错题复习 - 极限", "重做昨天极限板块错题 5 道,重点洛必达边界"),
        ("1800 题 · 一元函数微分", "1800 基础篇第 2 章挑 20 道中档"),
        ("武忠祥强化 ep{n}", "强化班第 {n} 讲录播 + 例题跟做"),
        ("定积分应用专题", "复习旋转体体积 + 弧长公式,做 10 题"),
        ("线代 · 行列式计算", "核心方法梳理 + 660 题行列式 15 道"),
        ("概率论 · 分布函数", "复习常见离散连续分布 + 配套习题 12 道"),
        ("多元微分复习", "梳理偏导/全微分/方向导数,做 8 道综合"),
        ("高数真题(数二) 2021", "本卷前 15 题限时 60 分钟"),
        ("武忠祥每日一题 · Day{n}", "公众号每日一题打卡"),
    ],
    "数据结构": [
        ("王道 4.2 二叉树遍历", "先序/中序/后序递归+非递归,编程实现"),
        ("王道 5.3 图的 DFS/BFS", "邻接表实现两种遍历 + 课后 8 题"),
        ("排序算法手写", "默写快排+归并+堆排序,分析时间复杂度"),
        ("王道 6.2 哈希表冲突处理", "链地址法/开放定址法,配套 10 题"),
        ("408 数据结构真题 2020", "限时 2 小时完成选择+大题"),
        ("串 KMP next 数组手算", "手算 3 个模式串 next,对照答案"),
        ("平衡树 AVL 旋转", "4 种旋转写一遍插入/删除"),
        ("B 树与 B+ 树对比", "整理差异表 + 思维导图"),
        ("王道每日错题 ep{n}", "错题本 ep{n} 重做"),
    ],
    "组成原理": [
        ("王道 CO 第 3 章存储系统", "SRAM/DRAM/Cache 三级结构 + 框架图"),
        ("Cache 替换算法", "LRU/FIFO/随机,手算 3 个访问序列"),
        ("流水线冒险", "结构/数据/控制冒险,整理 1 张表"),
        ("指令周期时序图", "画非流水/流水时序 + 对比吞吐率"),
        ("中断与异常处理", "软中断/硬中断流程图,配套 5 题"),
        ("总线仲裁方式", "集中/分布式仲裁对比 + 真题 3 道"),
        ("IEEE 754 浮点", "默写格式 + 3 个数转换练习"),
        ("输入输出 DMA 方式", "DMA 传输流程 + 真题"),
        ("CO 真题 2022 大题", "大题限时做 + 对答案"),
    ],
    "翻译": [
        ("2015 真题 Part 1", "唐静拆句 + 长难句 3 句改写"),
        ("唐静翻译基础班 ep{n}", "第 {n} 讲 + 10 句跟译"),
        ("英译汉 · 定语从句", "专项 10 句,注意中文语序"),
        ("真题精译 · 2017 Text 3", "逐句翻译 + 对照参考答案"),
        ("翻译真题 2019 Part 2", "限时 20 分钟完成"),
        ("长难句拆分专题", "选 5 个长难句,画句子结构图"),
        ("翻译错题复习", "重看上周错翻的 6 句"),
    ],
    "词汇": [
        ("墨墨 50 个新词", "背新词 + 例句记忆"),
        ("墨墨复习 120 个", "复习词汇 + 标记模糊词"),
        ("红宝书 Unit {n}", "Unit {n} 过一遍 + 跟读例句"),
        ("高频词冲刺 200", "刷考研 5500 高频榜单"),
        ("词根词缀记忆", "整理 10 个词根衍生词"),
        ("不背单词 30 分钟", "App 刷 30 分钟"),
        ("英语一真题词汇", "2020 年卷生词整理"),
    ],
    "阅读": [
        ("剑雅 10 Test 1 Passage 1", "限时 20 分钟 + 错题分析"),
        ("唐迟技巧班 ep{n}", "第 {n} 讲 + 配套篇章精读"),
        ("考研英语一 2019 阅读", "限时 70 分钟做 4 篇 + 总结"),
        ("阅读 Part A 精读", "1 篇文章逐句梳理"),
        ("新题型 · 七选五", "2 套新题型 + 技巧复盘"),
        ("阅读错题复盘", "上周错题重做 + 错因归类"),
    ],
    "其他": [
        ("政治启动 · 马原", "肖秀荣核心考点第 1 章"),
        ("错题回顾汇总", "本周各科错题翻一遍"),
        ("计划复盘 · 周回顾", "梳理本周完成情况,写 3 条反思"),
        ("政治强化 · 毛中特", "徐涛强化班 ep1 录播"),
        ("专业课笔记整理", "本周笔记誊写到云笔记"),
        ("心态调整 · 放松", "散步 30 分钟 + 写心情日记"),
    ],
}

# 高强度日(任务 6-7 张)
HIGH_INTENSITY_DAYS = {6, 13, 20, 27, 34}
# 摆烂日(全部 skipped)
LAZY_DAYS = {10, 18, 25, 32}
# T3 连续低完成率窗口:
#   - 历史窗口 Day 15-17:文档原设计,测"V3 能否从历史发现疲劳拐点"
#   - 近端窗口 Day 38-40:今天(2026-04-21)force_refresh 能直接感知到"最近 3 天 < 50%",触发降量
T3_WINDOW = {15, 16, 17, 38, 39, 40}


def pick_module() -> str:
    modules, weights = zip(*MODULE_WEIGHTS)
    return random.choices(modules, weights=weights, k=1)[0]


def pick_template(module: str) -> tuple[str, str]:
    return random.choice(TEMPLATES[module])


def render_task_text(module: str) -> tuple[str, str]:
    title_tmpl, desc_tmpl = pick_template(module)
    n = random.randint(1, 12)
    return title_tmpl.format(n=n), desc_tmpl.format(n=n)


def phase_of(day_offset: int) -> str:
    """1-based day_offset → 'fresh' / 'tired' / 'rebound'"""
    if 1 <= day_offset <= 14:
        return "fresh"
    if 15 <= day_offset <= 28:
        return "tired"
    return "rebound"


def feeling_for(phase_name: str) -> int:
    """按阶段权重抽 feeling(done 任务才调用)"""
    if phase_name == "fresh":
        return random.choices([2, 3, 4, 5], weights=[5, 15, 50, 30], k=1)[0]
    if phase_name == "tired":
        return random.choices([1, 2, 3, 4, 5], weights=[5, 15, 50, 25, 5], k=1)[0]
    return random.choices([2, 3, 4, 5], weights=[10, 35, 40, 15], k=1)[0]


def tasks_per_day(day_offset: int) -> int:
    if day_offset in HIGH_INTENSITY_DAYS:
        return random.randint(6, 7)
    return random.randint(4, 5)


def decide_status(day_offset: int, done_so_far: int, total: int, phase_name: str) -> str:
    """按阶段完成率 + T3 窗口 + 摆烂日 决定单张任务的 status"""
    if day_offset in LAZY_DAYS:
        return "skipped"

    if day_offset in T3_WINDOW:
        # 严格 < 40%:每天 done 只允许 1 张(5 张里 20%)
        if done_so_far >= 1:
            return random.choices(["skipped", "swapped"], weights=[80, 20], k=1)[0]
        # 首张 70% done,否则 skipped → 平均 done ≈ 0.7/5 = 14%
        return random.choices(["done", "skipped"], weights=[70, 30], k=1)[0]

    # 默认按阶段完成率
    if phase_name == "fresh":
        return random.choices(["done", "skipped", "swapped"], weights=[80, 12, 8], k=1)[0]
    if phase_name == "tired":
        return random.choices(["done", "skipped", "swapped"], weights=[55, 35, 10], k=1)[0]
    return random.choices(["done", "skipped", "swapped"], weights=[70, 20, 10], k=1)[0]


def extreme_feeling_days(num_weeks: int = 6) -> tuple[set[int], set[int]]:
    """每周随机 1 次挫败(1-2) + 1 次爽(5),返回 day_offset 集合"""
    lows: set[int] = set()
    highs: set[int] = set()
    for w in range(num_weeks):
        start = w * 7 + 1
        candidates = [d for d in range(start, min(start + 7, 41))]
        if not candidates:
            continue
        lows.add(random.choice(candidates))
        remain = [d for d in candidates if d not in lows]
        if remain:
            highs.add(random.choice(remain))
    return lows, highs


def main(reset: bool = False) -> None:
    random.seed(20260312)  # 固定种子,便于复现

    db: Session = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("[err] 无 user,先跑 scripts/seed_phases.py")
            return

        if reset:
            deleted = db.query(Task).filter(Task.note == FAKE_NOTE).delete()
            db.commit()
            print(f"[reset] 删除旧假数据 {deleted} 条")

        existing_fake = db.query(Task).filter(Task.note == FAKE_NOTE).count()
        if existing_fake:
            print(f"[skip] 已有 {existing_fake} 条假数据,--reset 清掉再跑")
            return

        low_days, high_days = extreme_feeling_days()
        print(f"[info] 本次生成的挫败日 (feeling≤2): {sorted(low_days)}")
        print(f"[info] 本次生成的爽日 (feeling=5): {sorted(high_days)}")

        total_tasks = 0
        total_done = 0
        total_skipped = 0
        per_phase_stat = {"fresh": [0, 0], "tired": [0, 0], "rebound": [0, 0]}  # [done, total]

        for day_offset in range(1, 41):
            d = START + timedelta(days=day_offset - 1)
            phase_name = phase_of(day_offset)
            n_tasks = tasks_per_day(day_offset)
            done_so_far = 0

            for seq in range(1, n_tasks + 1):
                module = pick_module()
                title, description = render_task_text(module)
                est = random.choice([30, 45, 60, 60, 75, 90, 120])

                status = decide_status(day_offset, done_so_far, n_tasks, phase_name)

                feeling: int | None = None
                actual: int | None = None
                completed_at: datetime | None = None

                if status == "done":
                    done_so_far += 1
                    feeling = feeling_for(phase_name)
                    # 极值覆盖:当天第一张 done 被选中时打上标
                    if day_offset in low_days and done_so_far == 1:
                        feeling = random.choice([1, 2])
                    elif day_offset in high_days and done_so_far == 2:
                        feeling = 5
                    actual = int(est * random.uniform(0.7, 1.15))
                    completed_at = datetime.combine(
                        d, time(random.randint(9, 22), random.randint(0, 59))
                    )

                t = Task(
                    user_id=user.id,
                    phase_id=None,  # 假数据早于当前 active phase,留空
                    date=d,
                    seq=seq,
                    module=module,
                    title=title,
                    description=description,
                    rationale=None,
                    estimated_minutes=est,
                    actual_minutes=actual,
                    status=status,
                    feeling=feeling,
                    note=FAKE_NOTE,
                    generated_at=datetime.combine(d, time(7, 0)),
                    completed_at=completed_at,
                )
                db.add(t)

                total_tasks += 1
                per_phase_stat[phase_name][1] += 1
                if status == "done":
                    total_done += 1
                    per_phase_stat[phase_name][0] += 1
                elif status == "skipped":
                    total_skipped += 1

        db.commit()

        print("")
        print(f"[ok] 生成 {total_tasks} 条假历史 (2026-03-12 → 2026-04-20)")
        print(f"     整体 done={total_done} ({total_done/total_tasks:.0%}), "
              f"skipped={total_skipped} ({total_skipped/total_tasks:.0%})")
        for pname, (d_, t_) in per_phase_stat.items():
            label = {"fresh": "新鲜期", "tired": "疲劳期", "rebound": "回升期"}[pname]
            print(f"     {label}: done {d_}/{t_} = {d_/t_:.0%}")

        # T3 窗口核查
        t3_stats = []
        for day_offset in sorted(T3_WINDOW):
            d = START + timedelta(days=day_offset - 1)
            day_tasks = db.query(Task).filter(
                Task.user_id == user.id, Task.date == d, Task.note == FAKE_NOTE
            ).all()
            done = sum(1 for t in day_tasks if t.status == "done")
            t3_stats.append(f"Day{day_offset}({d}): {done}/{len(day_tasks)} = {done/max(len(day_tasks),1):.0%}")
        print(f"     T3 窗口:")
        for s in t3_stats:
            print(f"       {s}")

    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="先删 __seed_fake 再生成")
    args = ap.parse_args()
    main(reset=args.reset)
