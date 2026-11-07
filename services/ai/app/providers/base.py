from typing import Any, Protocol


class ProviderError(Exception):
    """Provider unavailable or returned unusable output. Messages never include request content."""


class LLMProvider(Protocol):
    """AI_AGENTS.md §7. Providers have no tools: they cannot approve, transfer or change state."""

    name: str
    model_version: str

    async def generate_structured(
        self, *, system_prompt: str, user_payload: dict[str, Any], schema: dict[str, Any]
    ) -> dict[str, Any]: ...
