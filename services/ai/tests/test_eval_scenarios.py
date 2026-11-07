"""AI_AGENTS.md §8 synthetic evaluation set (10 scenarios). Not a production accuracy claim."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SCENARIOS = json.loads((Path(__file__).parent / "fixtures" / "scenarios.json").read_text())
INTAKE = {s["id"]: s for s in SCENARIOS["intake"]}
SUBMITTED_AT = "2026-11-06T18:00:00Z"


def run_intake(client: TestClient, scenario: dict) -> dict:
    res = client.post(
        "/v1/intake",
        json={
            "case_id": scenario["id"],
            "description": scenario["description"],
            "locality_label": scenario["locality_label"],
            "submitted_at": SUBMITTED_AT,
        },
    )
    assert res.status_code == 200, "schema-valid response expected for every scenario"
    return res.json()


def as_summary(client: TestClient, scenario_id: str) -> dict:
    scenario = INTAKE[scenario_id]
    result = run_intake(client, scenario)["result"]
    return {
        "case_id": scenario_id,
        "description": scenario["description"],
        "locality_label": scenario["locality_label"],
        "category": result["category"],
        "household_count": result["household_count"],
        "requested_items": result["requested_items"],
        "submitted_at": SUBMITTED_AT,
    }


@pytest.mark.parametrize("scenario", SCENARIOS["intake"], ids=lambda s: s["id"])
def test_intake_fixture(client: TestClient, scenario: dict) -> None:
    body = run_intake(client, scenario)
    expect, result = scenario["expect"], body["result"]
    for field in ("category", "household_count", "urgency_suggestion"):
        if field in expect:
            assert result[field] == expect[field], field
    if "needs_review" in expect:
        assert body["needs_review"] is expect["needs_review"]
    assert set(expect.get("missing_includes", [])) <= set(result["missing_fields"])


@pytest.mark.parametrize("pair", SCENARIOS["duplicates"], ids=lambda p: p["case"])
def test_duplicate_fixture(client: TestClient, pair: dict) -> None:
    res = client.post(
        "/v1/duplicates",
        json={"case": as_summary(client, pair["case"]), "candidates": [as_summary(client, p) for p in pair["pool"]]},
    )
    assert [c["case_id"] for c in res.json()["candidates"]] == pair["expect"]


@pytest.mark.parametrize("scenario", SCENARIOS["evidence"], ids=lambda s: s["id"])
def test_evidence_fixture(client: TestClient, scenario: dict) -> None:
    body = client.post("/v1/evidence", json=scenario["request"]).json()
    assert body["discrepancy_detected"] is scenario["expect"]["discrepancy_detected"]
    assert body["findings"][0]["kind"] == scenario["expect"]["first_kind"]
