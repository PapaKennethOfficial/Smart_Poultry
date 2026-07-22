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
    database_url: str = Field(
        default="postgresql+psycopg2://postgres:2230@localhost:5432/smartpoultry_db",
        alias="DATABASE_URL",
    )

    # ─── Server ──────────────────────────────────────────────────────────────
    port: int = Field(default=8000, alias="PORT")
    host: str = Field(default="127.0.0.1", alias="HOST")

    # ─── API-key security ────────────────────────────────────────────────────
    ai_service_api_key: str = Field(
        default="change_me_to_a_long_random_string",
        alias="AI_SERVICE_API_KEY",
    )

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
    google_api_key: str = Field(default="", alias="GOOGLE_API_KEY")
    gemini_model: str = Field(default="gemini-flash-latest", alias="GEMINI_MODEL")

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
