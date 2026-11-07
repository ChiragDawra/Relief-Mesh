# AI Agents and Workflow Specification

## 1. Design principle

ReliefMesh uses **bounded AI assistants**, not autonomous humanitarian decision-makers. The backend orchestrates small, typed tasks. Each task returns evidence, uncertainty and suggestions. Human users make all consequential decisions.

The term `agent` describes a bounded model-assisted workflow, not an agent that has permission to act on money or case state.

## 2. Agent overview

| Agent | Input | Output | Can change case status? | P0/P1 |
|---|---|---|---:|---:|
| Intake Structuring Agent | Plain-language request + locality label | Structured need, category, household size, urgency suggestion, missing fields | No | P0 |
| Duplicate Candidate Agent | Structured case + existing candidate summaries | Ranked possible duplicates, reasons and score | No | P0 |
| Evidence Review Agent | Invoice/delivery text or OCR fields + approved scope | Extracted amount/items/date and discrepancy flags | No | P1 (P0 may use manual structured form) |
| Triage Orchestrator | Case + outputs from bounded agents | Consolidated AI assessment record | No | P0 |

## 3. Intake Structuring Agent

### Input

```json
{
  "case_id": "uuid",
  "description": "Synthetic text supplied by volunteer",
  "locality_label": "Demo Ward 4",
  "submitted_at": "2026-11-06T18:00:00Z"
}
```

Do not send beneficiary name, phone number, exact address, medical notes or unredacted attachments to an external model. For demo, descriptions must be synthetic and should avoid sensitive details.

### Output schema

```json
{
  "category": "food|water|shelter|medical|transport|other",
  "requested_items": [
    {"name": "drinking_water", "quantity": 25, "unit": "litre"}
  ],
  "household_count": 5,
  "locality_label": "Demo Ward 4",
  "urgency_suggestion": "low|medium|high|critical",
  "urgency_reasons": ["The request says there is no safe drinking water."],
  "missing_fields": ["delivery_window"],
  "confidence": 0.88,
  "uncertainties": ["Household count was inferred from the phrase 'five families'."],
  "summary": "Five households request drinking water."
}
```

### Rules

- Never fabricate quantities, household counts or location. Use `null`/unknown if absent.
- Keep the original text accessible to the authorized reviewer for correction.
- Urgency is a recommendation. Explain the textual signal that led to it.
- `critical` must not be inferred from vague sentiment alone; require explicit immediate life-safety indicators and still label as a suggestion.
- If confidence is below configured threshold, populate `missing_fields` and ask a human to complete the record.

## 4. Duplicate Candidate Agent

### Candidate strategy

Combine several signals; do not rely on embedding similarity alone:

- Semantic similarity of redacted request descriptions.
- Same or adjacent locality label.
- Similar requested category/items.
- Overlapping submission time window.
- Household count / requested quantity similarity.

Return no more than three candidates.

### Output schema

```json
{
  "candidates": [
    {
      "case_id": "uuid",
      "similarity_score": 0.91,
      "reasons": [
        "Same demo locality",
        "Both request drinking water",
        "Descriptions are semantically similar"
      ],
      "differences": ["Reported household count differs by one"],
      "review_recommendation": "compare_records"
    }
  ],
  "disclaimer": "Similarity is not proof that the requests refer to the same household or are fraudulent. Human review is required."
}
```

The score is a ranking score, not a probability of fraud. Make thresholds configurable and log model/version used. Never auto-merge, suppress, reject or reduce aid based on a similarity score.

## 5. Evidence Review Agent

For P1, accept a synthetic invoice or delivery note. OCR/parser may extract:

- supplier name (compare with configured supplier record)
- invoice reference
- date
- line items
- quantity and unit
- subtotal/tax/total
- visible discrepancy indicators

Compare invoice total to approved amount and line items to requested items. Return exact extracted text/field confidence and differences.

**Never say:** "Delivery verified", "goods reached beneficiary", "fraud confirmed" or "invoice authentic" based solely on AI/OCR.

**Say:** "The uploaded document contains a total of 38 demo tokens; this differs from the approved 40-token amount by 2. Please inspect the original document."

A human reviewer examines the source and decides whether to authorize release.

## 6. Orchestration and deterministic policy layer

Recommended pipeline:

1. Save the request in Postgres.
2. Redact/minimize input.
3. Call the Intake Agent with a strict JSON schema.
4. Validate output with Pydantic/Zod.
5. Retrieve candidate cases using deterministic filters and optional embeddings.
6. Ask Duplicate Agent to rank/describe candidate overlap.
7. Save `ai_assessments` as immutable assessment snapshots.
8. Return suggestions to the web app.
9. Human reviews and explicitly chooses the next state.

No LLM tool should have access to a function such as `approve_case`, `release_funds`, `transfer_tokens`, `update_user_role` or arbitrary SQL.

## 7. Provider abstraction and fallback

Implement an interface:

```python
class LLMProvider(Protocol):
    async def generate_structured(self, *, system_prompt: str, user_payload: dict, schema: dict) -> dict: ...
```

Providers:

- `mock`: deterministic fixture output; used for repeatable hackathon demo/tests.
- `external`: chosen LLM API; secrets only on server side.

If provider is unavailable or output fails schema validation:

- Preserve the submitted case.
- Set AI status to `unavailable` or `needs_review`.
- Return manual-entry path.
- Never fill missing values with invented defaults.

## 8. Evaluation set

Create at least 10 synthetic scenarios:

- 3 distinct requests that should not match.
- 3 near-duplicate requests with wording variations.
- 1 same locality but different need (should not be called duplicate with high confidence).
- 1 missing quantity (must remain unknown).
- 1 ambiguous urgency case (must ask for review).
- 1 invoice total above approved budget (must flag discrepancy).

Track: schema-valid response rate, correct field extraction on fixtures, candidate precision in the small synthetic set, and rate of unsupported claims. Do not claim production accuracy from this tiny dataset.
