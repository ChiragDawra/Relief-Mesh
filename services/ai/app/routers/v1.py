from fastapi import APIRouter, Depends, HTTPException

from app.agents.duplicates import find_duplicates
from app.agents.evidence import review_evidence
from app.agents.intake import AgentUnavailable, run_intake
from app.config import Settings, get_settings
from app.providers import get_provider
from app.providers.base import LLMProvider
from app.schemas import (
    DuplicateRequest,
    DuplicateResponse,
    EvidenceRequest,
    EvidenceResponse,
    IntakeRequest,
    IntakeResponse,
)
from app.security import require_internal_token

router = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_token)])


@router.post("/intake", response_model=IntakeResponse)
async def intake(
    request: IntakeRequest,
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> IntakeResponse:
    try:
        return await run_intake(provider, request, settings.intake_confidence_threshold)
    except AgentUnavailable:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_UNAVAILABLE",
                "message": "AI provider unavailable or returned invalid output; continue with manual review.",
            },
        ) from None


@router.post("/duplicates", response_model=DuplicateResponse)
def duplicates(request: DuplicateRequest, settings: Settings = Depends(get_settings)) -> DuplicateResponse:
    return find_duplicates(request, settings.duplicate_min_score)


@router.post("/evidence", response_model=EvidenceResponse)
def evidence(request: EvidenceRequest) -> EvidenceResponse:
    return review_evidence(request)
