from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_provider_without_secrets() -> None:
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["provider"] in {"mock", "external"}
    assert "token" not in str(body).lower()
