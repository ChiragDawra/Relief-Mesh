"""Any OpenAI-compatible chat-completions endpoint using JSON-schema output (ADR-015)."""

import json
from typing import Any

import httpx

from app.providers.base import ProviderError


class OpenAICompatibleProvider:
    name = "external"

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str | None,
        model: str | None,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout_seconds: float = 20.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._client = httpx.AsyncClient(transport=transport, timeout=timeout_seconds)

    @property
    def model_version(self) -> str:
        return self._model or "unconfigured"

    async def generate_structured(
        self, *, system_prompt: str, user_payload: dict[str, Any], schema: dict[str, Any]
    ) -> dict[str, Any]:
        if not self._api_key or not self._model:
            raise ProviderError("external provider is not configured (AI_API_KEY / AI_MODEL)")
        try:
            response = await self._client.post(
                f"{self._base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        # Request text is passed as JSON data, never concatenated into instructions.
                        {"role": "user", "content": json.dumps(user_payload)},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": schema.get("title", "result"), "schema": schema},
                    },
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError(f"external provider failed: {type(exc).__name__}") from exc
        if not isinstance(parsed, dict):
            raise ProviderError("external provider returned a non-object")
        return parsed
