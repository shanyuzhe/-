# CCO 决策外包学习助手(v0.1)

## 项目目标
单用户(自己)备考雅思 7 天自测。验证"决策外包"概念能否坚持 2 周。
规划详见 PLAN.md。**改动前必读 PLAN 的"不做清单"**。

## 技术栈
- 后端: Python 3.12 + FastAPI + SQLAlchemy 2.0 + alembic + SQLite
- 前端: Next.js + Tailwind v4 + shadcn/ui(Claude design 风)
- LLM: **DeepSeek** via `openai` SDK(指向 `api.deepseek.com/v1`)
  - `deepseek-chat`(V3):每日任务生成,快
  - `deepseek-reasoner`(R1):周度总结/阶段校准,慢但深

## 并行 Agent 文件边界(严格遵守)
- `backend/`  → 后端 agent 独占
- `frontend/` → 前端 agent 独占
- `backend/alembic/versions/` → 串行,任何时刻只能一个 agent 写 migration
- `PLAN.md` / `CLAUDE.md` → 只有主 Claude 可改
- 跨边界改动 → 必须拆两个独立任务,不能并发

## LLM 调用规则
- **任何 LLM 响应必须 pydantic 校验**,失败 retry ≤ 2 次,仍失败则 fallback 到模板
- **任务生成按日幂等**:同日同用户只调 1 次 API(缓存到 `task` 表),手动点"刷新"才重调
- **禁止编数据**:上下文缺失时 prompt 里显式说"数据不够,请给保守建议",不要瞎估
- 统一用 `openai` SDK,在 `client = OpenAI(base_url=..., api_key=...)` 指向 DeepSeek
- 使用 JSON 模式:`response_format={"type": "json_object"}` 让 DeepSeek 强制返 JSON
- `max_tokens` 必须明确设置,任务生成 ≤ 2000,周度总结 ≤ 1500
- 开发期写 mock 模式(通过 env 变量),不在调试时疯狂消耗 token

## Git 纪律
- **每天至少 1 次 commit**,当天任务完成后立即 commit
- commit message 格式: `feat/fix/docs/refactor(scope): 描述`
- `.env` 和 `*.db` 在 `.gitignore`,绝不 commit
- 每个 Sprint 打 tag: `v0.1-day0`、`v0.1-day3`

## 开发环境
- Windows + PowerShell,脚本用 `.ps1` 或 `.py`,禁 `.sh`
- Python 入口脚本顶部必须:
  ```python
  import sys
  sys.stdout.reconfigure(encoding='utf-8', errors='replace')
  ```

## UI 风格约束(Claude design)
- 配色: 暖灰/象牙白背景(`#FAFAF7` 左右),accent 用 Claude 橙(`#CC785C` 左右)
- 字体: 衬线(Tiempos / Charter / Georgia)用于标题;无衬线(Inter)用于正文
- **不用 emoji**,用 `lucide-react` 线条图标
- 动效克制: 仅 opacity + translate,避免弹跳/旋转
- 圆角统一: `rounded-lg`(8px)或 `rounded-xl`(12px)
- 阴影: 仅 `shadow-sm`,不用 md/lg/xl

## Schema 演化
- Day 1 起用 alembic 管 migration,不事后补
- 任何 `backend/app/models.py` 改动必须立即生成 migration
- 不手工改表结构,一律走 `alembic revision --autogenerate`

## 不做清单(v0.1 内绝不扩张)
详见 PLAN.md,总结: 多用户 / 付费 / 部署 / 多模态 / 多科目 / 社交 /
移动端 / 情绪识别 / 知识图谱 / 向量 DB / 语音识别 / 图片 OCR

想扩张任何功能前,先问: 是不是 MVP 成败靠它? 99% 答案是"否"。
