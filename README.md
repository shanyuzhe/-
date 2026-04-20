# CCO — 决策外包学习助手

> "帮你决定今天学什么,你只管执行。"

单用户 MVP,用于验证"决策外包"概念对雅思备考是否有效。

## 核心目标

7 天自测,Day 7 必答:

1. 感觉"不用决定,只需要执行"了吗?
2. 任务卡质量 OK 吗?
3. Day 7 还想打开它吗?

详见 [PLAN.md](./PLAN.md)。

## 技术栈

- **后端**: Python 3.12 + FastAPI + SQLAlchemy 2.0 + alembic + SQLite
- **前端**: Next.js + Tailwind v4 + shadcn/ui(Claude design 风)
- **LLM**: DeepSeek(`deepseek-chat` + `deepseek-reasoner`)via `openai` SDK

## 项目结构

```
cco-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI 入口
│   │   ├── models.py            SQLAlchemy 6 张表
│   │   ├── schemas.py           pydantic 请求/响应模型
│   │   ├── db.py                engine + session
│   │   ├── llm.py               Claude API 封装
│   │   └── routers/             API 路由
│   │       ├── today.py         今日任务生成
│   │       ├── feedback.py      任务反馈提交
│   │       └── progress.py      进度查询
│   ├── alembic/                 DB migration
│   ├── scripts/                 seed / 工具脚本
│   └── tests/
├── prompts/                     LLM prompt 源文件
├── frontend/                    Day 1 开工
├── CLAUDE.md                    给 Claude 的指令
├── PLAN.md                      详细规划
└── README.md
```

## 快速开始(开发中)

### 后端

```powershell
cd backend
uv sync                                    # 或 pip install -e ".[dev]"
Copy-Item ..\.env.example ..\.env
# 编辑 .env 填入 ANTHROPIC_API_KEY
alembic upgrade head
python scripts/seed_phases.py              # 插入 3 阶段
uvicorn app.main:app --reload
```

后端起在 http://127.0.0.1:8000,API 文档:`/docs`。

### 前端(Day 1 开工)

```powershell
cd frontend
npm install
npm run dev
```

## 给 Claude 的工作守则

见 [CLAUDE.md](./CLAUDE.md)。
