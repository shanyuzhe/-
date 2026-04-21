"""应用配置(从项目根目录 .env 读)"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 项目根目录(backend/ 的上一级)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- DeepSeek ---
    DEEPSEEK_API_KEY: str = Field(default="")
    DEEPSEEK_BASE_URL: str = Field(default="https://api.deepseek.com/v1")
    MODEL_FAST: str = Field(default="deepseek-chat")      # V3, 用于每日任务生成
    MODEL_DEEP: str = Field(default="deepseek-reasoner")  # R1, 用于周度总结/阶段校准

    # --- DB ---
    DATABASE_URL: str = Field(default="sqlite:///./cco.db")
    DB_ECHO: bool = Field(default=False)

    # --- API server ---
    API_HOST: str = Field(default="127.0.0.1")
    API_PORT: int = Field(default=8000)
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000")

    # --- Dev ---
    MOCK_LLM: bool = Field(default=False)

    # --- v0.4 Auth ---
    JWT_SECRET: str = Field(default="cco-dev-secret-change-in-prod")
    JWT_ALGO: str = Field(default="HS256")
    JWT_EXPIRE_DAYS: int = Field(default=30)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
