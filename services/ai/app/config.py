from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Single root .env shared by all services (ADR-008).
ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, extra="ignore")

    ai_provider: Literal["mock", "external"] = "mock"
    ai_internal_token: str = "LOCAL_DEMO_INTERNAL_TOKEN"


@lru_cache
def get_settings() -> Settings:
    return Settings()
