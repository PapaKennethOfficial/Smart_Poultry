"""Route-optimisation endpoint."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

from ..security import require_api_key
from ..services import routing as routing_service


router = APIRouter(
    prefix="/api/v1/routes",
    tags=["routes"],
    dependencies=[Depends(require_api_key)],
)


# ─── Request / response schemas ─────────────────────────────────────────────

class StopIn(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    demand: int = Field(default=1, ge=0)


class VehicleIn(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    capacity: int = Field(default=999_999, ge=0)


class OptimizeRequest(BaseModel):
    depot: StopIn
    stops: List[StopIn] = Field(default_factory=list, max_length=200)
    vehicles: List[VehicleIn] = Field(..., min_length=1, max_length=50)
    time_limit_seconds: int = Field(default=5, ge=1, le=30)


@router.post("/optimize")
def optimize(payload: OptimizeRequest):
    try:
        result = routing_service.solve(
            depot=routing_service.Stop(
                id=payload.depot.id,
                lat=payload.depot.lat,
                lon=payload.depot.lon,
                demand=payload.depot.demand,
            ),
            stops=[
                routing_service.Stop(id=s.id, lat=s.lat, lon=s.lon, demand=s.demand)
                for s in payload.stops
            ],
            vehicles=[
                routing_service.Vehicle(id=v.id, capacity=v.capacity)
                for v in payload.vehicles
            ],
            time_limit_seconds=payload.time_limit_seconds,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except RuntimeError as exc:
        logger.warning("Routing failed: {}", exc)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
