"""Demand forecasting via Facebook Prophet.

Data source
    Daily aggregate of DeliveryOrder rows in the operational Postgres DB.
    We SUM(quantity) per day, excluding cancelled orders, to produce a
    univariate time series suitable for a univariate Prophet model.

Model lifecycle
    Trained models are pickled to app/models/cache/demand.pkl (path
    configurable via MODEL_CACHE_DIR). `predict()` will train-on-demand if
    no cached model exists; a background retraining scheduler (out of scope
    for Phase A) can call `train()` on a schedule.

Metrics
    MAPE (Mean Absolute Percentage Error) and RMSE are computed on a
    time-based holdout so managers can see how far off the forecast is,
    following standard practice for time-series evaluation (Hyndman &
    Athanasopoulos, 2021).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from loguru import logger
from prophet import Prophet
from sqlalchemy import text

from ..config import get_settings
from ..db import get_session


MODEL_FILENAME = "demand.pkl"


# ─── Data access ────────────────────────────────────────────────────────────

def _daily_totals_query() -> str:
    # Aggregate one row per day (in UTC). We exclude CANCELLED orders — those
    # never happened from a fulfilment perspective. Also exclude zero-quantity
    # rows which would just add noise.
    return """
        SELECT
            date_trunc('day', "deliveryDate") :: date AS ds,
            SUM(quantity)::float                     AS y
        FROM "DeliveryOrder"
        WHERE "status" <> 'CANCELLED'
          AND "deliveryDate" >= :cutoff
          AND "quantity" > 0
        GROUP BY date_trunc('day', "deliveryDate")
        ORDER BY ds ASC
    """


def load_history() -> pd.DataFrame:
    """Pull daily order-quantity history from Postgres.

    Returns a DataFrame with the two columns Prophet expects: ``ds``
    (day-truncated date) and ``y`` (total quantity that day). Days with
    no orders are zero-filled so Prophet sees a continuous series rather
    than gaps that would confuse its seasonality decomposition.
    """
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.forecast_history_days)

    with get_session() as session:
        rows = session.execute(text(_daily_totals_query()), {"cutoff": cutoff}).all()

    df = pd.DataFrame(rows, columns=["ds", "y"])
    if df.empty:
        return df

    df["ds"] = pd.to_datetime(df["ds"])
    df = df.set_index("ds")

    # Zero-fill missing days so Prophet gets a continuous series.
    full_index = pd.date_range(df.index.min(), df.index.max(), freq="D")
    df = df.reindex(full_index, fill_value=0.0)
    df.index.name = "ds"
    return df.reset_index()


# ─── Model training ─────────────────────────────────────────────────────────

@dataclass
class TrainResult:
    mape: float | None
    rmse: float | None
    n_train: int
    n_holdout: int
    trained_at: str
    model_path: str
    warnings: list[str] = field(default_factory=list)


def _model_path() -> Path:
    settings = get_settings()
    p = settings.model_cache_path
    p.mkdir(parents=True, exist_ok=True)
    return p / MODEL_FILENAME


def train() -> TrainResult:
    """Fit Prophet on the whole history, compute holdout metrics, cache the fit.

    We fit a *second* Prophet on the pre-holdout slice purely to compute
    MAPE/RMSE — the model we persist is the one trained on the full data
    (more information available at prediction time). This is a common
    pattern: evaluate with a holdout, ship the model trained on everything.
    """
    df = load_history()
    warnings: list[str] = []

    if df.empty or len(df) < 14:
        raise RuntimeError(
            f"Not enough history to train a forecast (have {len(df)} days, need >= 14). "
            "Seed some DeliveryOrder rows first."
        )

    # Time-based holdout: last 14 days (or 20% of the series, whichever is smaller).
    holdout_n = min(14, max(3, len(df) // 5))
    train_df = df.iloc[:-holdout_n]
    holdout_df = df.iloc[-holdout_n:]

    mape: float | None = None
    rmse: float | None = None

    if len(train_df) >= 14:
        try:
            eval_model = _new_prophet()
            eval_model.fit(train_df)
            future = eval_model.make_future_dataframe(periods=holdout_n)
            pred = eval_model.predict(future).tail(holdout_n)
            actual = holdout_df["y"].values
            predicted = pred["yhat"].values
            # Avoid divide-by-zero: MAPE is undefined when actual == 0.
            mask = actual != 0
            if mask.any():
                mape = float(
                    np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
                )
            rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
        except Exception as exc:  # pragma: no cover — evaluation is best-effort
            logger.warning("Evaluation Prophet run failed: {}", exc)
            warnings.append(f"Metrics unavailable: {exc}")

    # Final production model — trained on *all* history.
    final_model = _new_prophet()
    final_model.fit(df)

    path = _model_path()
    joblib.dump(
        {
            "model": final_model,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_rows": len(df),
        },
        path,
    )

    return TrainResult(
        mape=None if mape is None else round(mape, 2),
        rmse=None if rmse is None else round(rmse, 2),
        n_train=len(train_df),
        n_holdout=len(holdout_df),
        trained_at=datetime.now(timezone.utc).isoformat(),
        model_path=str(path),
        warnings=warnings,
    )


def _new_prophet() -> Prophet:
    # Weekly seasonality is our strong signal for a delivery business
    # (weekends behave differently). Yearly is on by default; if there's
    # < 2 years of data Prophet will disable it automatically.
    return Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality="auto",
        interval_width=0.85,   # 85% confidence band
    )


# ─── Prediction ─────────────────────────────────────────────────────────────

def _load_cached_model() -> dict[str, Any] | None:
    """Load the fitted Prophet model from disk.

    Security note: joblib uses pickle under the hood, which is unsafe for
    untrusted input. The pickle file at MODEL_CACHE_DIR is *only ever*
    written by :func:`train` in this same process, never uploaded by a
    user or fetched from the network. Reading it back is therefore safe —
    the file lives on the same filesystem as the running service.
    """
    path = _model_path()
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception as exc:
        logger.warning("Failed to load cached model {}: {}", path, exc)
        return None


def predict(days: int) -> dict[str, Any]:
    """Return N future-day predictions plus historical actuals.

    Response shape (kept lean — the frontend line chart consumes this directly):
        {
          "history":  [{ "ds": "2026-06-01", "y":  120 }, ...],
          "forecast": [{ "ds": "2026-07-19", "yhat": 132.4,
                          "yhat_lower": 108.1, "yhat_upper": 156.7 }, ...],
          "metrics":  { "mape": 12.5, "rmse": 18.3, ... },
          "trained_at": "2026-07-18T14:22:11+00:00",
          "cache_hit": true
        }
    """
    cached = _load_cached_model()
    trained_now = False
    metrics_from_training: TrainResult | None = None
    if cached is None:
        logger.info("No cached forecast model found; training now.")
        metrics_from_training = train()
        cached = _load_cached_model()
        trained_now = True
        if cached is None:
            raise RuntimeError("Model training completed but cache load still failed.")

    model: Prophet = cached["model"]

    # Historical for the chart — pull the last 60 days (or all we have).
    hist_df = load_history().tail(60)
    history = [
        {"ds": row["ds"].strftime("%Y-%m-%d"), "y": float(row["y"])}
        for _, row in hist_df.iterrows()
    ]

    # Future frame
    future = model.make_future_dataframe(periods=days)
    fcst = model.predict(future).tail(days)
    forecast = [
        {
            "ds": pd.to_datetime(row["ds"]).strftime("%Y-%m-%d"),
            "yhat": float(max(0.0, row["yhat"])),
            "yhat_lower": float(max(0.0, row["yhat_lower"])),
            "yhat_upper": float(max(0.0, row["yhat_upper"])),
        }
        for _, row in fcst.iterrows()
    ]

    return {
        "history": history,
        "forecast": forecast,
        "metrics": (
            {
                "mape": metrics_from_training.mape,
                "rmse": metrics_from_training.rmse,
                "n_train": metrics_from_training.n_train,
                "n_holdout": metrics_from_training.n_holdout,
                "warnings": metrics_from_training.warnings,
            }
            if metrics_from_training is not None
            else {"note": "Loaded cached model; run POST /forecast/retrain for fresh metrics."}
        ),
        "trained_at": cached["trained_at"],
        "cache_hit": not trained_now,
    }
