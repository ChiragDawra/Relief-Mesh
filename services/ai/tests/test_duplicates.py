from typing import Any

from fastapi.testclient import TestClient

from app.schemas import DUPLICATE_DISCLAIMER


def summary(case_id: str, description: str, locality: str = "Demo Ward 4", category: str = "water", **extra: Any) -> dict:
    return {
        "case_id": case_id,
        "description": description,
        "locality_label": locality,
        "category": category,
        "submitted_at": "2026-11-06T18:00:00Z",
        **extra,
    }


ORIGINAL = summary("a", "Five families in Demo Ward 4 need drinking water after the flood. Request 25 litres.", household_count=5)


def duplicates(client: TestClient, case: dict, candidates: list[dict]) -> dict:
    res = client.post("/v1/duplicates", json={"case": case, "candidates": candidates})
    assert res.status_code == 200
    return res.json()


def test_surfaces_a_near_duplicate_with_reasons(client: TestClient) -> None:
    case = summary("b", "Demo Ward 4: five households have no clean drinking water since the flood, 25 litres.", household_count=5)
    body = duplicates(client, case, [ORIGINAL])
    assert body["disclaimer"] == DUPLICATE_DISCLAIMER
    [candidate] = body["candidates"]
    assert candidate["case_id"] == "a"
    assert candidate["similarity_score"] >= 0.55
    assert candidate["review_recommendation"] == "compare_records"
    assert "Same demo locality" in candidate["reasons"]


def test_same_locality_different_need_is_not_a_candidate(client: TestClient) -> None:
    case = summary("c", "A clinic in Demo Ward 4 needs 10 first aid kits for minor injuries.", category="medical")
    assert duplicates(client, case, [ORIGINAL])["candidates"] == []


def test_ignores_self_and_returns_at_most_three_ranked(client: TestClient) -> None:
    pool = [summary(str(i), ORIGINAL["description"], household_count=5) for i in range(5)] + [ORIGINAL]
    body = duplicates(client, ORIGINAL, pool)
    ids = [c["case_id"] for c in body["candidates"]]
    assert len(ids) == 3 and "a" not in ids
    scores = [c["similarity_score"] for c in body["candidates"]]
    assert scores == sorted(scores, reverse=True)


def test_household_difference_is_reported(client: TestClient) -> None:
    case = summary("d", ORIGINAL["description"], household_count=6)
    [candidate] = duplicates(client, case, [ORIGINAL])["candidates"]
    assert "Reported household count differs by 1" in candidate["differences"]
