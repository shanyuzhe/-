"""FastAPI 入口"""
import sys

# Windows GBK 防御:所有会打印到 stdout 的入口脚本必须有这两行
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.config import settings  # noqa: E402
from app.routers import feedback, plan, progress, today  # noqa: E402

app = FastAPI(
    title="CCO — 决策外包学习助手",
    description="雅思备考认知执行官(v0.1 Plus:支持外部 AI 规划导入)",
    version="0.1.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(today.router)
app.include_router(feedback.router)
app.include_router(progress.router)
app.include_router(plan.router)


@app.get("/")
def root():
    return {"service": "CCO Backend", "version": "0.1.1"}


@app.get("/health")
def health():
    return {"ok": True, "mock_llm": settings.MOCK_LLM}
