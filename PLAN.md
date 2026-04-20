# CCO 决策外包学习助手 - MVP 规划 v0.1

> 2026-04-20 启动规划
> 用户定位:单玉喆(自己是第一个测试用户)
> 目标规模:10-20 人小规模测试

---

## 核心假设

**要验证的**:备考族愿意把"今天学什么、学多久、从哪下手"这种决策外包给 AI,并且能坚持用 ≥ 2 周。

**如果证伪**:产品概念不成立,止损。
**如果证实**:v2 扩大规模,考虑付费/多科目/社交。

---

## Step 1 分析要点

### 产品本质
- 不是 AI 老师,是**决策外包 + 认知负荷削减**
- 相对 Khanmigo/Duolingo:在"学什么之前"介入,不在"怎么学"介入
- 核心差异点真实存在,但用户教育成本极高

### 三个危险假设(Step 1.2)
1. 上来就用 Zep/Graphiti/TMK = 核爆杀蚊子,MVP 用 SQLite 足够
2. "决策外包带来安全感"不一定对所有备考用户成立 —— 真正决策疲劳的人可能根本不打开 APP
3. LLM 靠文本"感知情绪"不靠谱,MVP 放弃这条,只做"进度 + 延迟感知"

### MVP 边界(Step 1.3)
- 1 个科目(雅思)
- 10-20 人测试
- SQLite,不上图数据库
- 标准 ReAct,不上 RP-ReAct/TMK
- 只做进度+延迟感知,不做情绪识别

---

## Step 2 MVP 计划

### 技术选型
- **宏观记忆**:SQLite + 周度 LLM 总结
- **微观记忆**:`micro_events` 表(最近 7 天行为)
- **推理**:标准 ReAct,Claude API 直调
- **前端**:Streamlit 起骨架(后续可换 Next.js)
- **后端**:FastAPI(10-20 人并发无压力)

### 6 个 MVP 模块
1. 目标管理
2. 晨会任务生成(LLM)
3. 任务完成反馈(打分)
4. 进度可视化
5. 周度总结(LLM)
6. 存储层

### 明确不做(push back 用)
- ❌ 移动端 APP ❌ 用户系统(除最简认证) ❌ 付费
- ❌ 社交/排行榜 ❌ 知识图谱/向量 DB ❌ 情绪识别
- ❌ 多模态 ❌ 多科目 ❌ 产品化商业化

### 技术风险 Top 3
1. Claude API 延迟破坏晨会体验 → 预生成+手动刷新
2. LLM 任务生成不稳定 → temperature=0.3 + 明确 prompt
3. schema 早期必然乱改 → 从 Day 1 用 alembic

### 产品风险 Top 3
1. 自用 3 天就不想用(心脏衰竭)
2. "自己是目标用户"视角偏差
3. 时间超预算

---

## Step 3 五个核心问题的判断

1. **失控阈值**:早期 3 选项,信任积累后渐进推硬排程
2. **连续 3 天未完成**:停机问人,不要自动"滚雪球"补进度
3. **记忆读写延迟**:MVP 不是问题(学习心流粒度是 25-50 分钟)
4. **支架褪除**:不拿走,只加新形式,锚定能力进步
5. **"自己是目标用户"**:短期优势,长期陷阱,必须访谈 3 个真用户

---

## 下一步(对话探讨中,持续更新)

<!-- 每次讨论完一块,在这里追加要点 -->

## 决策日志

<!-- 格式:YYYY-MM-DD: 决策 / 理由 -->
- 2026-04-20: MVP 目标用户从"1 人自用"调整为"10-20 人小规模测试"
- 2026-04-20: v0.1 先做自用 MVP 验证,7 天(Max 订阅到期前)完成;过关再做多用户版 v0.2
- 2026-04-20: 采纳 Claude Code 加速打法,3 天开发 → 改为"一两晚做完 + 剩余时间体验"
- 2026-04-20: 首测用户定档 5 同学 + 小红书粉丝(需单独讨论宣传角度)
- 2026-04-20: **核心验证假设**:用户(首先是自己)能否坚持 7 天用,且感到"决策外包"真的减轻内耗
- 2026-04-20: **LLM 选型改为 DeepSeek**(原 Claude Sonnet 4.6)。理由:中文场景质量更好、成本低一个数量级、用户已在毕设集成过有经验。用 `openai` SDK 指向 DeepSeek base_url,JSON 模式强制结构化输出。

## v0.1 用户画像(我自己)

- 考试:雅思,2026-08-30(距今 132 天)
- 每日投入:6-8 小时
- 黄金时段:下午到晚上
- 弱点:口语 ≈ 听力 > 写作 > 阅读
- UI 风格:Claude design 高级风

## 为什么做自用 MVP 而不是直接做多用户产品

- **先验证核心假设**:自己用了觉得好,再谈推广
- **砍掉用户系统/认证/部署/安全**,专注产品核心流程
- **Max 订阅期内开发成本近 0**,几乎是零风险尝试
- **自用数据本身就是首批真实用户数据**,v0.2 可以直接用

---

## v0.1 技术栈

- **前端**:Next.js + Tailwind v4 + shadcn/ui,Claude design 高级风格
- **后端**:FastAPI + SQLAlchemy 2.0 + SQLite
- **DB 迁移**:alembic(Day 1 起用)
- **LLM**:DeepSeek(`deepseek-chat` 做实时任务、`deepseek-reasoner` 做周总结),用 `openai` Python SDK 指向 DeepSeek base_url
- **运行**:localhost,不部署
- **认证**:无(v1 单用户)

## 数据库 Schema(6 张表)

```sql
-- ① 用户配置
CREATE TABLE user (
  id INTEGER PRIMARY KEY,
  exam_date DATE NOT NULL,
  daily_hours REAL DEFAULT 7,
  prefer_slots TEXT,       -- JSON ["afternoon","evening"]
  weakness_rank TEXT,      -- JSON ["speaking","listening","writing","reading"]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ② 整体目标(宏观)
CREATE TABLE goal (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  name TEXT,
  target_score REAL,
  current_estimate REAL,   -- LLM 周度校准
  deadline DATE,
  created_at TIMESTAMP
);

-- ③ 阶段(中观)
CREATE TABLE phase (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER,
  name TEXT,
  start_date DATE,
  end_date DATE,
  focus_modules TEXT,      -- JSON
  target_tasks INTEGER,
  created_at TIMESTAMP
);

-- ④ 任务卡(中观-微观)
CREATE TABLE task (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  phase_id INTEGER,
  date DATE,
  seq INTEGER,
  module TEXT,
  title TEXT,
  description TEXT,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  status TEXT DEFAULT 'pending',
  feeling INTEGER,
  note TEXT,
  generated_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- ⑤ 事件日志(最细)
CREATE TABLE event (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT,
  task_id INTEGER,
  detail_json TEXT
);

-- ⑥ 周度总结(LLM derived)
CREATE TABLE weekly_summary (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  week_start DATE,
  week_end DATE,
  summary_text TEXT,
  detected_patterns TEXT,
  completion_rate REAL,
  avg_feeling REAL,
  module_distribution TEXT,
  suggestions_text TEXT,
  created_at TIMESTAMP
);
```

## 多粒度覆盖设计

| 粒度 | 数据源 | 形式 | 更新 | 用途 |
|---|---|---|---|---|
| 整体 | `goal` | 表 | LLM 周校准 `current_estimate` | "能不能考到 6.5" |
| 阶段 | `phase` + `task` 聚合 | 表 + view | 自动 | "基础阶段还差几天" |
| 周 | `weekly_summary` | 表 | LLM 周日生成 | 上周怎样/下周怎么改 |
| 日 | `task` WHERE date=today | SQL 聚合 | 实时 | 今日卡片 |
| 任务 | `task` | 表 | 用户反馈 | 单卡得分/耗时 |
| 事件 | `event` | 表 | 自动 | 底层行为流(所有派生源) |

## LLM 调用 3 个触发点

1. **每日任务生成**:每天第一次打开或手动刷新。输入:整体+阶段+周进度+近 7 天细粒度+今日偏好。输出:3-5 张任务卡 JSON。
2. **周度总结**:每周日 22:00 自动。输入:本周 tasks+events+上周 summary。输出:200 字观察+下周建议。
3. **阶段切换校准**:阶段结尾。输出:更新 `goal.current_estimate` + 调整下阶段 focus。

**预估成本(DeepSeek)**:自用一年 < ¥10(V3 输入 ¥2/M、R1 推理 ¥4/M)。

## 三阶段硬编码(v0.1 已拍板 a 方案)

| 阶段 | 日期 | 天数 | Focus(基于弱点) |
|---|---|---|---|
| 🏗️ 基础 | 2026-04-20 → 05-31 | 42 | listening + reading(补基础,听力弱要早开始) |
| 💪 强化 | 2026-06-01 → 07-20 | 50 | speaking + writing + listening(弱项集中刷) |
| 🔥 冲刺 | 2026-07-21 → 08-30 | 41 | all + 全真模考 |

## 4 晚开发路线

| 晚 | 工作 | 产出 |
|---|---|---|
| Day 0 | DB + FastAPI + prompt v1 + seed 3 phases | 后端能返 JSON |
| Day 1 | Next.js + API 对接 + 基础 3 页 | 能看到卡片 |
| Day 2 | shadcn 深度定制 + design tokens | 视觉向 Claude 官网靠 |
| Day 3 | 动效 + 微交互 + 打磨 | **v0.1 Feature Complete** |
| Day 4-7 | **不动代码,纯体验** | 日记式记录 |

## MVP 成功标准(Day 7 必答)

| 问题 | 含义 |
|---|---|
| ① 感觉"不用决定,只需执行"了吗? | 核心概念是否成立 |
| ② 任务卡质量 OK 吗? | LLM 能力够不够 |
| ③ Day 7 还想打开吗? | 留存直觉 |

3✅ → v0.2;1-2❌ → 迭代;全❌ → 止损。

---

## v0.2 备选清单(先挂着,别提前做)

- 🔎 **Web search**(Tavily/Serper + DeepSeek function calling):自动抓本周雅思口语新题、官方考情
- 👥 多用户支持 + 极简认证(JWT/token)
- 🌐 部署上线(轻量云服务器,10-20 人测试)
- 📊 进度图表升级(recharts,非 matplotlib)
- 🎙️ 雅思口语录音 → 转写 → 评分(后期重型功能)
- 🧠 LLM 自动阶段切分(替代现在的硬编码 3 阶段)
- ⏰ 智能提醒(每天黄金时段推送任务)

---

## v0.1 Plus:外部 AI 共创规划导入(2026-04-20 加入)

### 核心思想
不做站内多轮对话。**让用户去 Claude / ChatGPT / Kimi / 豆包 web 端聊规划**(借它们的 web search 真实推荐能力),拿到规划文本**粘贴进来**,我们做 extraction + 每日任务注入。

### 为什么这比 v0.2 对话版更好
- 零 web search 工程成本:外包给主流大模型
- 用户可用自己熟悉的 AI,多轮修正免费
- 我们只负责**结构化解析** + **每日任务注入**
- 工程量从 13h → 5h

### 用户流程
1. 首次打开 → "还没有规划?从 AI 生成一份"
2. 复制 prompt 模板 → 去外部 AI 聊 10-20 分钟(利用 web search)
3. 回来粘贴 AI 的回复
4. 后端 DeepSeek-R1 做 extraction → 结构化 JSON
5. 用户 review + 采纳 → 替换硬编码 3 阶段
6. 之后每日任务 prompt 自动读 plan → 任务含具体资源/原则/checkpoint

### 数据模型
- 新表 `learning_plan`(`raw_text` + `subject` + `source_ai` + `status` + `phases_data` + `resources` + `daily_habits` + `task_principles` + `checkpoints`)
- `phase` 表加 `plan_id`(nullable,用户未导入时 fallback 到硬编码)

### 用户 prompt 模板 5 Section 结构
- **A. 阶段划分**(name, dates, focus_modules, objectives)
- **B. 资源推荐**(name, url, type, why, phase)— 强制 web search 真实资源
- **C. 每日 habit**(habit, tool, amount, timing)
- **D. 任务生成原则**(list of strings)
- **E. 自检机制**(小 checkpoint 每 2-3 周 + 全真模考 2 次)

### 新增 API 端点
- `GET /plan/template` — 给用户复制的 prompt 模板
- `POST /plan/import` — 粘贴 AI 回复 → extract → 返回 draft
- `POST /plan/{id}/activate` — 采纳 + 同步到 phase 表
- `GET /plan/active` — 前端查当前 active plan
- `GET /plan/{id}` — 查某 plan

### 学科泛化
- `subject` 字段:`"ielts"` / `"gre"` / `"考研英语"` / `"Python 入门"`
- v0.1 UI 雅思专版,架构字段已兼容
- v0.3 再加"新建其他科目"入口

### 每日任务 prompt 注入
`generate_tasks.md` 新增 `<learning_plan>` section:
- `task_principles`(硬原则,必须遵守)
- `daily_habits`(每天必做)
- 当前阶段的 `resources`(优先推荐)
- 近 14 天的 `checkpoints`(提醒准备)

### 工程量
- 后端:~3h(表 + migration + LLM extraction + 5 个 route + today prompt 升级)
- 前端:~2h(`/onboarding` 页 + 首页 CTA + 解析结果预览)
- **合计 5h,Day 1 晚上继续冲**

