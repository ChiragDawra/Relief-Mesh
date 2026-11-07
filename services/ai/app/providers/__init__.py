from functools import lru_cache

from app.config import get_settings
from app.providers.base import LLMProvider
from app.providers.external import OpenAICompatibleProvider
from app.providers.mock import MockProvider


@lru_cache
def get_provider() -> LLMProvider:
    settings = get_settings()
    if settings.ai_provider == "external":
        return OpenAICompatibleProvider(
            base_url=settings.ai_base_url, api_key=settings.ai_api_key, model=settings.ai_model
        )
    return MockProvider()
