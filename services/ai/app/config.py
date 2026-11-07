from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Single root .env shared by all services (ADR-008).
ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, extra="ignore")

    ai_provider: Literal["mock", "external"] = "mock"
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str | None = None
    ai_api_key: str | None = None
    ai_internal_token: str = "LOCAL_DEMO_INTERNAL_TOKEN"
    duplicate_min_score: float = 0.55
    intake_confidence_threshold: float = 0.6


@lru_cache
def get_settings() -> Settings:
    return Settings()
