"""Centralised configuration for the SmartPoultry AI microservice.

Uses pydantic-settings so every value is validated at boot-time and every
consumer gets a typed object. `Settings()` is cached with lru_cache so a
FastAPI Depends(...) always returns the same instance without re-parsing env.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ─── Database ────────────────────────────────────────────────────────────
    # No default: a real database password must never live in source. Boot
    # fails with a clear pydantic error if DATABASE_URL is unset.
    database_url: str = Field(alias="DATABASE_URL")

    # ─── Server ──────────────────────────────────────────────────────────────
    port: int = Field(default=8000, alias="PORT")
    host: str = Field(default="127.0.0.1", alias="HOST")

    # ─── API-key security ────────────────────────────────────────────────────
    # No default. A guessable shared secret is the same as no secret: this key
    # is the only thing standing between the AI service and any local process.
    ai_service_api_key: str = Field(alias="AI_SERVICE_API_KEY")

    # ─── CORS ────────────────────────────────────────────────────────────────
    node_backend_origin: str = Field(
        default="http://localhost:5001",
        alias="NODE_BACKEND_ORIGIN",
    )

    # ─── Forecast tuning ─────────────────────────────────────────────────────
    forecast_history_days: int = Field(default=180, alias="FORECAST_HISTORY_DAYS")
    forecast_default_horizon: int = Field(default=14, alias="FORECAST_DEFAULT_HORIZON")
    model_cache_dir: str = Field(default="app/models/cache", alias="MODEL_CACHE_DIR")

    # ─── LLM (Phase B) ───────────────────────────────────────────────────────
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama3-8b-8192", alias="GROQ_MODEL")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def model_cache_path(self) -> Path:
        return Path(self.model_cache_dir)


@lru_cache
def get_settings() -> Settings:
    return Settings()
