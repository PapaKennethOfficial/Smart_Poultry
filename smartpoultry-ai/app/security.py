"""API-key auth dependency.

Every non-health request must present the X-API-Key header matching
AI_SERVICE_API_KEY. The Node backend is the only trusted caller;
customer/driver browsers never hit this service directly.
"""

from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings


def require_api_key(
    x_api_key: str = Header(default="", alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not x_api_key or x_api_key != settings.ai_service_api_key:
        # Use 401 not 403 — this is *authentication* not authorisation.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-API-Key header",
        )
