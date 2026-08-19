"""Time-series forecasting via Facebook Prophet.

Two series are modelled, each with its own cached model:

    "demand"  Daily SUM(DeliveryOrder.quantity), cancelled orders excluded.
              What customers ask for.

    "eggs"    Daily SUM(LogEntry.eggsCount), soft-deleted rows excluded.
              What the farm actually produces.

Modelling both is what lets the dashboard put supply and demand on one axis.
Before this, the egg "forecast" was the last ten days of actuals relabelled as
predictions with a hardcoded 85% confidence — see the git history of
smartpoultry-backend/src/controllers/analytics.controller.js.

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


# ─── Series registry ────────────────────────────────────────────────────────
# Adding a series means adding one entry here. Everything downstream —
# training, caching, prediction, the API — is driven off this dict.

SERIES: dict[str, dict[str, str]] = {
    "demand": {
        "label": "Order demand",
        "unit": "units",
        "cache": "demand.pkl",
        # CANCELLED orders never happened from a fulfilment perspective.
        # Zero-quantity rows would only add noise.
        "query": """
            SELECT
                date_trunc('day', "deliveryDate")::date AS ds,
                SUM(quantity)::float                    AS y
            FROM "DeliveryOrder"
            WHERE "status" <> 'CANCELLED'
              AND "deliveryDate" >= :cutoff
              AND "quantity" > 0
            GROUP BY date_trunc('day', "deliveryDate")
            ORDER BY ds ASC
        """,
    },
    "eggs": {
        "label": "Egg production",
        "unit": "eggs",
        "cache": "eggs.pkl",
        # LogEntry rows are soft-deleted via deletedAt; excluded here so a
        # corrected entry doesn't double-count.
        "query": """
            SELECT
                date_trunc('day', "date")::date AS ds,
                SUM("eggsCount")::float         AS y
            FROM "LogEntry"
            WHERE "date" >= :cutoff
              AND "deletedAt" IS NULL
            GROUP BY date_trunc('day', "date")
            ORDER BY ds ASC
        """,
    },
}

DEFAULT_SERIES = "demand"


def _series_spec(series: str) -> dict[str, str]:
    spec = SERIES.get(series)
    if spec is None:
        raise ValueError(
            f"Unknown series {series!r}. Known series: {', '.join(sorted(SERIES))}"
        )
    return spec


# ─── Data access ────────────────────────────────────────────────────────────

def load_history(series: str = DEFAULT_SERIES) -> pd.DataFrame:
    """Pull daily history for `series` from Postgres.

    Returns a DataFrame with the two columns Prophet expects: ``ds``
    (day-truncated date) and ``y`` (the daily total). Days with no rows are
    zero-filled so Prophet sees a continuous series rather than gaps that
    would confuse its seasonality decomposition.
    """
    spec = _series_spec(series)
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.forecast_history_days)

    with get_session() as session:
        rows = session.execute(text(spec["query"]), {"cutoff": cutoff}).all()

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
    # "prophet" when a real model was fitted, "naive_fallback" when it was not.
    engine: str = "prophet"
    failure: str | None = None


def _model_path(series: str = DEFAULT_SERIES) -> Path:
    spec = _series_spec(series)
    settings = get_settings()
    p = settings.model_cache_path
    p.mkdir(parents=True, exist_ok=True)
    return p / spec["cache"]


def train(series: str = DEFAULT_SERIES) -> TrainResult:
    """Fit Prophet on the whole history, compute holdout metrics, cache the fit.

    We fit a *second* Prophet on the pre-holdout slice purely to compute
    MAPE/RMSE — the model we persist is the one trained on the full data
    (more information available at prediction time). This is a common
    pattern: evaluate with a holdout, ship the model trained on everything.
    """
    spec = _series_spec(series)
    df = load_history(series)
    warnings: list[str] = []

    if df.empty or len(df) < 14:
        source = "DeliveryOrder" if series == "demand" else "LogEntry"
        raise RuntimeError(
            f"Not enough history to train the {spec['label']} forecast "
            f"(have {len(df)} days, need >= 14). Add more {source} rows first."
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
    #
    # If Prophet cannot fit we fall back to a flat 7-day average so the app
    # keeps working, but that fallback MUST be visible. Previously the failure
    # was logged and then forgotten: the cache held the string "NAIVE_FALLBACK",
    # /retrain still returned 200 with metrics, and the dashboard presented a
    # flat average as a machine-learning forecast. That is the kind of thing a
    # reviewer finds and you cannot explain.
    engine = "prophet"
    failure: str | None = None
    try:
        final_model = _new_prophet()
        final_model.fit(df)
        model_to_save = final_model
    except Exception as exc:
        failure = f"{type(exc).__name__}: {exc}"
        logger.error(
            "Prophet training FAILED for series {} — falling back to a flat "
            "average. Cause: {}", series, failure
        )
        warnings.append(
            "Prophet could not be fitted, so this forecast is a flat 7-day "
            f"average, not a model. Cause: {failure}"
        )
        engine = "naive_fallback"
        model_to_save = "NAIVE_FALLBACK"

    path = _model_path(series)
    joblib.dump(
        {
            "model": model_to_save,
            "series": series,
            "engine": engine,
            "failure": failure,
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
        engine=engine,
        failure=failure,
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

def _load_cached_model(series: str = DEFAULT_SERIES) -> dict[str, Any] | None:
    """Load the fitted Prophet model from disk.

    Security note: joblib uses pickle under the hood, which is unsafe for
    untrusted input. The pickle file at MODEL_CACHE_DIR is *only ever*
    written by :func:`train` in this same process, never uploaded by a
    user or fetched from the network. Reading it back is therefore safe —
    the file lives on the same filesystem as the running service.
    """
    path = _model_path(series)
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception as exc:
        logger.warning("Failed to load cached model {}: {}", path, exc)
        return None


def predict(
    days: int,
    series: str = DEFAULT_SERIES,
    allow_training: bool = True,
) -> dict[str, Any]:
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
    spec = _series_spec(series)
    cached = _load_cached_model(series)
    trained_now = False
    metrics_from_training: TrainResult | None = None
    if cached is None:
        if not allow_training:
            # Callers on a request path (the morning briefing, the advisor)
            # must never block for a Prophet fit — training can take tens of
            # seconds and will blow the Node gateway's 30s timeout, surfacing
            # as an opaque network error rather than a useful message.
            raise RuntimeError(
                f"The {series} model has not been trained yet. "
                "Run POST /api/v1/forecast/retrain, or wait for the weekly job."
            )
        logger.info("No cached {} model found; training now.", series)
        metrics_from_training = train(series)
        cached = _load_cached_model(series)
        trained_now = True
        if cached is None:
            raise RuntimeError("Model training completed but cache load still failed.")

    model = cached["model"]

    # Historical for the chart — pull the last 60 days (or all we have).
    hist_df = load_history(series).tail(60)
    history = [
        {"ds": row["ds"].strftime("%Y-%m-%d"), "y": float(row["y"])}
        for _, row in hist_df.iterrows()
    ]

    if model == "NAIVE_FALLBACK":
        avg_7d = hist_df["y"].tail(7).mean() if not hist_df.empty else 0.0
        forecast = []
        for i in range(1, days + 1):
            next_date = (pd.to_datetime(history[-1]["ds"]) if history else pd.Timestamp.now()) + pd.Timedelta(days=i)
            forecast.append({
                "ds": next_date.strftime("%Y-%m-%d"),
                "yhat": float(avg_7d),
                "yhat_lower": float(avg_7d * 0.8),
                "yhat_upper": float(avg_7d * 1.2),
            })
    else:
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
        "series": series,
        "label": spec["label"],
        "unit": spec["unit"],
        # Never let a flat average be mistaken for a fitted model.
        "engine": cached.get("engine", "prophet" if model != "NAIVE_FALLBACK" else "naive_fallback"),
        "degraded": model == "NAIVE_FALLBACK",
        "failure": cached.get("failure"),
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
