"""Forecast endpoints — order demand and egg production."""

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


def _predict(series: str, days: int | None, settings: Settings):
    horizon = days if days is not None else settings.forecast_default_horizon
    try:
        return forecast_service.predict(horizon, series=series)
    except ValueError as exc:
        # Unknown series name — caller error.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        # Not enough data / training failed — surface a friendly 422 rather
        # than a 500, because "seed more rows" is an actionable answer.
        logger.warning("Forecast unavailable for {}: {}", series, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )


@router.get("/demand")
def demand(
    days: int = Query(default=None, ge=1, le=90),
    settings: Settings = Depends(get_settings),
):
    """N-day forward order-demand prediction plus 60 days of actuals.

    Trains on first call if no cached model exists; later calls hit the
    joblib cache (~50 ms).
    """
    return _predict("demand", days, settings)


@router.get("/eggs")
def eggs(
    days: int = Query(default=None, ge=1, le=90),
    settings: Settings = Depends(get_settings),
):
    """N-day forward egg-production prediction plus 60 days of actuals.

    Same Prophet pipeline as /demand, run against LogEntry.eggsCount. This
    replaces the old Node endpoint that returned recent actuals relabelled
    as predictions with a hardcoded 85% confidence.
    """
    return _predict("eggs", days, settings)


@router.get("/series")
def series():
    """List the modellable series, so the frontend needn't hardcode them."""
    return {
        "series": [
            {"key": key, "label": spec["label"], "unit": spec["unit"]}
            for key, spec in forecast_service.SERIES.items()
        ]
    }


@router.post("/retrain")
def retrain(
    series: str = Query(default=None, description="Omit to retrain every series"),
):
    """Force a fresh training run. Used by the weekly scheduler.

    With no `series` argument every registered series is retrained, so the
    existing cron job keeps both models current without needing to know
    which series exist.
    """
    targets = [series] if series else list(forecast_service.SERIES)
    results, failures = {}, {}

    for key in targets:
        try:
            r = forecast_service.train(key)
            results[key] = {
                # Which engine actually produced this model. "naive_fallback"
                # means Prophet could not fit and the numbers are a flat
                # average — never let that pass as a trained model.
                "engine": r.engine,
                "failure": r.failure,
                "mape": r.mape,
                "rmse": r.rmse,
                "n_train": r.n_train,
                "n_holdout": r.n_holdout,
                "warnings": r.warnings,
                "trained_at": r.trained_at,
                "model_path": r.model_path,
            }
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        except RuntimeError as exc:
            # One series lacking data must not fail the whole retrain — a farm
            # with orders but no logbook entries is a normal early state.
            logger.warning("Retrain failed for {}: {}", key, exc)
            failures[key] = str(exc)

    if not results:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=failures or "No series could be retrained",
        )

    return {
        "message": f"Retrained {len(results)} of {len(targets)} series",
        "results": results,
        "failures": failures,
        # Kept flat for the existing Node cron job, which logs
        # data.metrics.mape after a retrain.
        "metrics": results.get("demand") or next(iter(results.values())),
    }


@router.get("/diagnostics")
def diagnostics():
    """Why is the forecast degraded? Answers it directly, with the real error.

    Attempts a minimal Prophet fit and reports the full exception if it fails.
    Prophet 1.1.x drives cmdstan under the hood, and on Windows the most common
    cause is that the cmdstan backend was never built during pip install — the
    Python package imports fine and only fails at fit() time, which is why this
    surfaces as a silent fallback rather than an install error.
    """
    import sys as _sys
    import traceback

    report: dict = {
        "python": _sys.version.split()[0],
        "series": {},
    }

    try:
        import prophet
        report["prophet_version"] = getattr(prophet, "__version__", "unknown")
    except Exception as exc:
        report["prophet_import_error"] = f"{type(exc).__name__}: {exc}"
        return report

    try:
        import cmdstanpy
        report["cmdstanpy_version"] = getattr(cmdstanpy, "__version__", "unknown")
        try:
            report["cmdstan_path"] = cmdstanpy.cmdstan_path()
        except Exception as exc:
            report["cmdstan_path_error"] = f"{type(exc).__name__}: {exc}"
    except Exception as exc:
        report["cmdstanpy_import_error"] = f"{type(exc).__name__}: {exc}"

    # Prophet's _load_stan_backend() loops over backends and, if every one
    # fails, falls through to a debug log that references an attribute it never
    # assigned. The result is a misleading "no attribute 'stan_backend'" that
    # hides the real cause. Instantiate the backend directly to get it.
    try:
        from prophet.models import CmdStanPyBackend
        CmdStanPyBackend()
        report["stan_backend"] = "ok"
    except Exception as exc:
        report["stan_backend"] = "FAILED"
        report["stan_backend_error"] = f"{type(exc).__name__}: {exc}"
        report["stan_backend_traceback"] = traceback.format_exc().splitlines()[-10:]

    # Prophet 1.1.6 ships a trimmed CmdStan tree alongside its pre-compiled
    # binary. cmdstanpy validates that tree and requires a makefile; the shipped
    # one does not always have it.
    try:
        import importlib_resources
        bundled = importlib_resources.files("prophet") / "stan_model" / "cmdstan-2.33.1"
        report["bundled_cmdstan"] = {
            "path": str(bundled),
            "exists": bundled.is_dir(),
            "has_makefile": (bundled / "makefile").is_file() if bundled.is_dir() else False,
        }
        binp = importlib_resources.files("prophet") / "stan_model" / "prophet_model.bin"
        report["prophet_model_bin_exists"] = binp.is_file()
    except Exception as exc:
        report["bundled_cmdstan_error"] = f"{type(exc).__name__}: {exc}"

    # A tiny synthetic fit. If this fails the install is broken, independent of
    # whatever is or is not in the database.
    try:
        import pandas as pd
        from prophet import Prophet

        df = pd.DataFrame({
            "ds": pd.date_range("2026-01-01", periods=30, freq="D"),
            "y": [100 + (i % 7) * 5 for i in range(30)],
        })
        Prophet(weekly_seasonality=True, yearly_seasonality=False).fit(df)
        report["synthetic_fit"] = "ok"
    except Exception as exc:
        report["synthetic_fit"] = "FAILED"
        report["synthetic_fit_error"] = f"{type(exc).__name__}: {exc}"
        report["synthetic_fit_traceback"] = traceback.format_exc().splitlines()[-12:]

    # Per-series state: how much history exists, and what the cache holds.
    for key in forecast_service.SERIES:
        entry: dict = {}
        try:
            hist = forecast_service.load_history(key)
            entry["history_days"] = len(hist)
            entry["enough_to_train"] = len(hist) >= 14
        except Exception as exc:
            entry["history_error"] = f"{type(exc).__name__}: {exc}"
        cached = forecast_service._load_cached_model(key)
        if cached:
            entry["cached_engine"] = cached.get("engine", "unknown")
            entry["cached_failure"] = cached.get("failure")
            entry["trained_at"] = cached.get("trained_at")
            entry["degraded"] = cached.get("model") == "NAIVE_FALLBACK"
        else:
            entry["cached"] = False
        report["series"][key] = entry

    return report
