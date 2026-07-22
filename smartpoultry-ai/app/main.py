"""FastAPI application entry-point.

Run in dev:
    py -m uvicorn app.main:app --reload --port 8000

Run in prod (via Docker later):
    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import forecast as forecast_router
from .routers import insights as insights_router
from .routers import routes as routes_router


settings = get_settings()

app = FastAPI(
    title="SmartPoultry AI Service",
    description=(
        "Machine-learning microservice for the SmartPoultry platform. "
        "Provides demand forecasting (Prophet) and vehicle route "
        "optimisation (Google OR-Tools). Called only by the Node.js "
        "backend using the X-API-Key header — never by browsers."
    ),
    version="1.0.0",
)

# Only the Node backend is trusted; browsers never talk to this service
# directly. The Node origin is configurable via NODE_BACKEND_ORIGIN.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.node_backend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["X-API-Key", "Content-Type"],
)


@app.get("/", tags=["meta"])
def root():
    return {"service": "smartpoultry-ai", "status": "ok", "version": app.version}


@app.get("/health", tags=["meta"])
def health():
    """Liveness probe — unauthenticated so orchestrators can check it."""
    return {"status": "ok"}


app.include_router(forecast_router.router)
app.include_router(routes_router.router)
app.include_router(insights_router.router)
