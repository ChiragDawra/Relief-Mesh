from fastapi import FastAPI

from app.config import get_settings

app = FastAPI(title="ReliefMesh AI service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "reliefmesh-ai", "provider": get_settings().ai_provider}
