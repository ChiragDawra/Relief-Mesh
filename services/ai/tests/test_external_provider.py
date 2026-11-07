import asyncio
import json

import httpx
import pytest

from app.agents.intake import SYSTEM_PROMPT, AgentUnavailable, run_intake
from app.providers.base import ProviderError
from app.providers.external import OpenAICompatibleProvider
from app.schemas import IntakeRequest, IntakeResult
from tests.conftest import DEMO_REQUEST

REQUEST = IntakeRequest(
    case_id="c1", description=DEMO_REQUEST, locality_label="Demo Ward 4", submitted_at="2026-11-06T18:00:00Z"
)
VALID = {
    "category": "water",
    "requested_items": [{"name": "drinking_water", "quantity": 25, "unit": "litre"}],
    "household_count": 5,
    "locality_label": "Demo Ward 4",
    "urgency_suggestion": "high",
    "urgency_reasons": ["No safe drinking water for today."],
    "missing_fields": [],
    "confidence": 0.9,
    "uncertainties": [],
    "summary": "Five households request drinking water.",
}


def provider_returning(content: str, seen: list[httpx.Request] | None = None) -> OpenAICompatibleProvider:
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    return OpenAICompatibleProvider(
        base_url="https://llm.test/v1", api_key="k", model="m", transport=httpx.MockTransport(handler)
    )


def test_valid_structured_output_passes_policy() -> None:
    seen: list[httpx.Request] = []
    response = asyncio.run(run_intake(provider_returning(json.dumps(VALID), seen), REQUEST, 0.6))
    assert response.provider == "external"
    assert response.result.household_count == 5
    sent = json.loads(seen[0].content)
    assert sent["messages"][0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert json.loads(sent["messages"][1]["content"])["description"] == DEMO_REQUEST
    assert sent["response_format"]["json_schema"]["name"] == IntakeResult.model_json_schema()["title"]


def test_malformed_json_falls_back_after_retry() -> None:
    seen: list[httpx.Request] = []
    with pytest.raises(AgentUnavailable):
        asyncio.run(run_intake(provider_returning("not json", seen), REQUEST, 0.6))
    assert len(seen) == 2


def test_extra_decision_fields_are_rejected() -> None:
    with pytest.raises(AgentUnavailable):
        asyncio.run(run_intake(provider_returning(json.dumps({**VALID, "approved": True})), REQUEST, 0.6))


def test_unconfigured_provider_fails_closed() -> None:
    provider = OpenAICompatibleProvider(base_url="https://llm.test/v1", api_key=None, model=None)
    with pytest.raises(ProviderError):
        asyncio.run(provider.generate_structured(system_prompt="", user_payload={}, schema={}))
