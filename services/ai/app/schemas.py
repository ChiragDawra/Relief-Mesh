"""Strict request/response models. Mirrored by packages/shared/src/ai.ts on the API side."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["food", "water", "shelter", "medical", "transport", "other"]
Urgency = Literal["low", "medium", "high", "critical"]
BaseUnits = Annotated[str, Field(pattern=r"^\d{1,20}$")]

DUPLICATE_DISCLAIMER = (
    "Similarity is not proof that the requests refer to the same household or are fraudulent. "
    "Human review is required."
)
EVIDENCE_DISCLAIMER = (
    "Document checks cannot prove physical delivery. An authorized reviewer must inspect the original evidence."
)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RequestedItem(Strict):
    name: str = Field(min_length=1, max_length=80)
    quantity: int | None = Field(default=None, gt=0, le=1_000_000)
    unit: str | None = Field(default=None, min_length=1, max_length=30)


class IntakeRequest(Strict):
    case_id: str
    description: str = Field(min_length=5, max_length=5000)
    locality_label: str = Field(min_length=2, max_length=120)
    submitted_at: datetime


class IntakeResult(Strict):
    """Structured draft. Extra keys (e.g. an 'approved' flag) are rejected, not ignored."""

    model_config = ConfigDict(extra="forbid", title="IntakeResult")

    category: Category
    requested_items: list[RequestedItem] = Field(max_length=20)
    household_count: int | None = Field(gt=0, le=10_000)
    locality_label: str
    urgency_suggestion: Urgency | None
    urgency_reasons: list[str] = Field(max_length=10)
    missing_fields: list[str] = Field(max_length=10)
    confidence: float = Field(ge=0, le=1)
    uncertainties: list[str] = Field(max_length=10)
    summary: str = Field(max_length=300)


class IntakeResponse(Strict):
    result: IntakeResult
    provider: str
    model_version: str
    needs_review: bool
    human_review_required: Literal[True] = True


class CaseSummary(Strict):
    case_id: str
    description: str = Field(max_length=5000)
    locality_label: str
    category: Category
    household_count: int | None = None
    requested_items: list[RequestedItem] = Field(default_factory=list, max_length=20)
    submitted_at: datetime


class DuplicateRequest(Strict):
    case: CaseSummary
    candidates: list[CaseSummary] = Field(max_length=50)


class DuplicateCandidate(Strict):
    case_id: str
    similarity_score: float = Field(ge=0, le=1)
    reasons: list[str]
    differences: list[str]
    review_recommendation: Literal["compare_records"] = "compare_records"


class DuplicateResponse(Strict):
    candidates: list[DuplicateCandidate] = Field(max_length=3)
    disclaimer: str = DUPLICATE_DISCLAIMER
    method: str
    min_score: float


class EvidenceRequest(Strict):
    approved_amount_base_units: BaseUnits
    token_decimals: int = Field(ge=0, le=12)
    requested_items: list[RequestedItem] = Field(max_length=20)
    invoice_reference: str | None = Field(default=None, max_length=80)
    invoice_total_base_units: BaseUnits | None = None
    line_items: list[RequestedItem] = Field(max_length=50)


FindingKind = Literal[
    "total_matches",
    "total_mismatch",
    "total_missing",
    "item_missing",
    "item_quantity_differs",
    "item_not_requested",
]


class EvidenceFinding(Strict):
    kind: FindingKind
    message: str


class EvidenceResponse(Strict):
    findings: list[EvidenceFinding]
    discrepancy_detected: bool
    disclaimer: str = EVIDENCE_DISCLAIMER
    human_review_required: Literal[True] = True
