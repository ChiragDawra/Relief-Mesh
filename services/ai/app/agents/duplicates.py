"""Duplicate Candidate Agent (AI_AGENTS.md §4): deterministic, explainable ranking. Never merges or rejects."""

import re
from datetime import timedelta

from app.schemas import CaseSummary, DuplicateCandidate, DuplicateRequest, DuplicateResponse

METHOD = "reliefmesh-multi-signal-v1"
MAX_CANDIDATES = 3
TIME_WINDOW = timedelta(hours=72)
WEIGHTS = {"text": 0.45, "locality": 0.25, "category": 0.15, "household": 0.10, "time": 0.05}

_STOPWORDS = frozenset(
    "a an the and or of for in on at to is are be need needs needed request requests requesting "
    "after from with have has they them their this that we our please some".split()
)


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 1 and t not in _STOPWORDS}


def _jaccard(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a | b else 0.0


def score_pair(case: CaseSummary, other: CaseSummary) -> DuplicateCandidate:
    text = _jaccard(_tokens(case.description), _tokens(other.description))
    same_locality = case.locality_label.strip().lower() == other.locality_label.strip().lower()
    same_category = case.category == other.category
    both_counts = case.household_count is not None and other.household_count is not None
    household = (
        1 - abs(case.household_count - other.household_count) / max(case.household_count, other.household_count)
        if both_counts
        else 0.5  # unknown counts are neutral, not evidence either way
    )
    within_window = abs(case.submitted_at - other.submitted_at) <= TIME_WINDOW

    score = (
        WEIGHTS["text"] * text
        + WEIGHTS["locality"] * same_locality
        + WEIGHTS["category"] * same_category
        + WEIGHTS["household"] * household
        + WEIGHTS["time"] * within_window
    )

    reasons, differences = [], []
    if same_locality:
        reasons.append("Same demo locality")
    else:
        differences.append(f"Different locality ({other.locality_label})")
    if same_category:
        reasons.append(f"Both request {case.category}")
    else:
        differences.append(f"Different need category ({other.category})")
    if text >= 0.3:
        reasons.append("Descriptions share much of the same wording")
    else:
        differences.append("Descriptions use mostly different wording")
    if within_window:
        reasons.append("Submitted within 72 hours of each other")
    if both_counts and case.household_count == other.household_count:
        reasons.append("Same reported household count")
    elif both_counts:
        differences.append(f"Reported household count differs by {abs(case.household_count - other.household_count)}")

    return DuplicateCandidate(
        case_id=other.case_id, similarity_score=round(score, 3), reasons=reasons, differences=differences
    )


def find_duplicates(request: DuplicateRequest, min_score: float) -> DuplicateResponse:
    scored = [
        score_pair(request.case, other) for other in request.candidates if other.case_id != request.case.case_id
    ]
    ranked = sorted((c for c in scored if c.similarity_score >= min_score), key=lambda c: -c.similarity_score)
    return DuplicateResponse(candidates=ranked[:MAX_CANDIDATES], method=METHOD, min_score=min_score)
