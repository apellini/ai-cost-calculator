from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Application
    app_title: str = "AI Cost Calculator"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://aicost:changeme@localhost:5432/aicost_db"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8 hours

    # LLM Backend: mock | ollama | lmstudio | openai_compat
    llm_backend: str = "mock"
    llm_base_url: str = "http://localhost:11434"
    llm_model: str = "llama3.1:8b"
    llm_api_key: str = ""

    # Data refresh
    refresh_interval: str = "daily"  # daily | weekly | manual

    # Batch analysis threshold (seconds)
    batch_threshold_seconds: int = 120

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Invite links base URL (used to build /login?token=... links)
    app_base_url: str = "http://localhost:5173"

    # SMTP (optional — leave smtp_host empty to disable email sending)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    smtp_tls: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
