from fastapi import FastAPI

from app.config import get_settings
from app.routers.v1 import router as v1_router

app = FastAPI(title="ReliefMesh AI service", version="0.1.0")
app.include_router(v1_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "reliefmesh-ai", "provider": get_settings().ai_provider}
