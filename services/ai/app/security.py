import hmac

from fastapi import Depends, Header, HTTPException

from app.config import Settings, get_settings


def require_internal_token(
    x_internal_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Only the ReliefMesh API may call /v1/* (ADR-015)."""
    if not x_internal_token or not hmac.compare_digest(x_internal_token, settings.ai_internal_token):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHENTICATED", "message": "Invalid internal token."})
