import json

from fastapi.testclient import TestClient

FORBIDDEN = ("delivery verified", "goods reached", "fraud confirmed", "invoice authentic", "delivery confirmed")
WATER = [{"name": "drinking_water", "quantity": 25, "unit": "litre"}]


def evidence(client: TestClient, total: str | None, lines: list[dict] = WATER) -> dict:
    res = client.post(
        "/v1/evidence",
        json={
            "approved_amount_base_units": "40000000",
            "token_decimals": 6,
            "requested_items": WATER,
            "invoice_reference": "DEMO-INV-1042",
            "invoice_total_base_units": total,
            "line_items": lines,
        },
    )
    assert res.status_code == 200
    return res.json()


def assert_no_delivery_claims(body: dict) -> None:
    text = json.dumps(body).lower()
    assert not any(phrase in text for phrase in FORBIDDEN)


def test_flags_total_below_approved_with_exact_difference(client: TestClient) -> None:
    body = evidence(client, "38000000")
    assert body["discrepancy_detected"] is True
    assert body["findings"][0] == {
        "kind": "total_mismatch",
        "message": "The submitted invoice total is 38 demo tokens; this is 2 below the approved 40 demo tokens. "
        "Please inspect the original document.",
    }
    assert_no_delivery_claims(body)


def test_matching_invoice_still_requires_human_review(client: TestClient) -> None:
    body = evidence(client, "40000000")
    assert body["discrepancy_detected"] is False
    assert body["human_review_required"] is True
    assert [f["kind"] for f in body["findings"]] == ["total_matches"]
    assert_no_delivery_claims(body)


def test_reports_item_differences(client: TestClient) -> None:
    body = evidence(
        client,
        "40000000",
        [{"name": "drinking_water", "quantity": 20, "unit": "litre"}, {"name": "tarp", "quantity": 1, "unit": "piece"}],
    )
    kinds = [f["kind"] for f in body["findings"]]
    assert kinds == ["total_matches", "item_quantity_differs", "item_not_requested"]
    assert body["discrepancy_detected"] is True
    assert_no_delivery_claims(body)


def test_missing_total_is_a_discrepancy(client: TestClient) -> None:
    body = evidence(client, None)
    assert body["findings"][0]["kind"] == "total_missing"
    assert body["discrepancy_detected"] is True
