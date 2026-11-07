from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.providers import get_provider
from app.providers.mock import MockProvider

TOKEN = "test-internal-token"
DEMO_REQUEST = (
    "Five families in Demo Ward 4 need drinking water after the flood. "
    "They have no safe drinking water for today. Request 25 litres."
)


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, ai_provider="mock", ai_internal_token=TOKEN)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_provider] = MockProvider
    with TestClient(app, headers={"X-Internal-Token": TOKEN}) as test_client:
        yield test_client
    app.dependency_overrides.clear()
