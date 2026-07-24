"""Demand-forecast endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from ..config import Settings, get_settings
from ..security import require_api_key
from ..services import forecast as forecast_service


router = APIRouter(
    prefix="/api/v1/forecast",
    tags=["forecast"],
    dependencies=[Depends(require_api_key)],
)


@router.get("/demand")
def demand(
    days: int = Query(default=None, ge=1, le=90),
    settings: Settings = Depends(get_settings),
):
    """N-day forward demand prediction plus 60-day historical actuals.

    Trains on first call if no cached model exists. Subsequent calls hit
    the joblib cache (~50 ms). Client-visible response shape matches what
    the frontend Recharts LineChart consumes directly.
    """
    horizon = days if days is not None else settings.forecast_default_horizon
    try:
        return forecast_service.predict(horizon)
    except RuntimeError as exc:
        # Not enough data / training failed — surface a friendly 422.
        logger.warning("Forecast unavailable: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.post("/retrain")
def retrain():
    """Force a fresh training run. Useful for the weekly scheduler."""
    try:
        result = forecast_service.train()
        return {
            "message": "Model retrained",
            "metrics": {
                "mape": result.mape,
                "rmse": result.rmse,
                "n_train": result.n_train,
                "n_holdout": result.n_holdout,
                "warnings": result.warnings,
            },
            "trained_at": result.trained_at,
            "model_path": result.model_path,
        }
    except RuntimeError as exc:
        logger.warning("Retrain failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
