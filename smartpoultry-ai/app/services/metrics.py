"""Metrics aggregator used by the LLM insights endpoints.

Covers BOTH halves of the business:
  * sales/logistics  — DeliveryOrder, Product, driver throughput
  * the farm itself  — LogEntry (eggs, mortality, feed, water, environment)
  * the models       — Prophet forecast state, accuracy and horizon

Until this file grew a farm section the advisor was a sales analyst that had
never heard of a chicken: it could answer "how many pending deliveries" and
nothing at all about eggs, mortality or feed, because LogEntry was never read.
It also could not describe its own forecast, because the Prophet output was
never passed in.

Everything the LLM ever sees comes from this file. Keeping the
aggregation logic centralised means the sanitiser (services/sanitizer.py)
has one narrow input surface to defend, and the prompts have one
predictable schema to reason about.

Nothing here writes to the DB — read-only aggregation only.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from loguru import logger
from sqlalchemy import text

from ..db import get_session
from . import forecast as forecast_service


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


# ─── The public entry point ─────────────────────────────────────────────────

def weekly_snapshot(
    reference: datetime | None = None,
    days: int = 7,
    include_forecast: bool = True,
) -> dict[str, Any]:
    """Aggregate KPIs for the trailing `days` ending at `reference` (UTC now).

    The window is a parameter rather than a constant so the advisor can answer
    "how did last month go?" instead of only ever seeing seven days.

    Missing data becomes an explicit `null` or an `available: false` block so
    the prompt can say "we didn't record that" or "the model isn't trained yet"
    rather than hallucinating a number.
    """
    days = max(1, min(int(days), 365))
    now = (reference or datetime.now(timezone.utc)).replace(microsecond=0)
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    with get_session() as session:
        current = _period_totals(session, start, now)
        previous = _period_totals(session, prev_start, start)
        top_products = _top_products(session, start, now)
        status_funnel = _status_funnel(session, start, now)
        driver_stats = _driver_stats(session, start, now, limit=3)
        pending_backlog = _pending_backlog(session)
        farm_current = _farm_totals(session, start, now)
        farm_previous = _farm_totals(session, prev_start, start)  # for the deltas only
        # Cap the daily series: a 90-day window would otherwise put 90 rows
        # into every prompt, which is what pushes Groq into a 400.
        # 7 rows is enough for the model to spot a bad day without spending
        # the whole token budget on a table.
        farm_daily = _farm_daily(session, start, now, limit=min(days, 7))
        inventory = _inventory(session)

    snapshot: dict[str, Any] = {
        "generated_at": now.isoformat(),
        "window": {
            "start": start.isoformat(),
            "end": now.isoformat(),
            "days": days,
        },
        # Key names kept as current_week/previous_week for backwards
        # compatibility with the existing prompts and sanitiser, even though
        # the window is now variable. `window.days` states the real length.
        "current_week": current,
        "previous_week": previous,
        "week_over_week": {
            "revenue_change_pct": _pct_change(current["revenue"], previous["revenue"]),
            "order_change_pct": _pct_change(current["order_count"], previous["order_count"]),
            "aov_change_pct": _pct_change(current["aov"], previous["aov"]),
        },
        "top_products": top_products,
        "status_funnel": status_funnel,
        "driver_stats": driver_stats,
        "pending_backlog": pending_backlog,
        "farm_current": farm_current,
        "farm_daily": farm_daily,
        "farm_change": {
            "eggs_change_pct": _pct_change(farm_current["eggs"], farm_previous["eggs"]),
            "mortality_change_pct": _pct_change(
                farm_current["mortality"], farm_previous["mortality"]
            ),
            "feed_change_pct": _pct_change(farm_current["feed_kg"], farm_previous["feed_kg"]),
        },
        "inventory": inventory,
    }

    if include_forecast:
        snapshot["forecasts"] = forecast_summary()

    return snapshot


# ─── Forecast state ─────────────────────────────────────────────────────────

def forecast_summary(horizon: int = 7) -> dict[str, Any]:
    """Describe each Prophet model so the advisor can explain its own forecast.

    Returns, per series, what the model is, what it was trained on, how
    accurate it was on the holdout, and what it predicts next. When a model
    cannot be produced we return `available: false` plus the reason, so the
    advisor can say WHY there is no forecast instead of "I don't have that
    data" — which is what it said before this existed.
    """
    out: dict[str, Any] = {
        "model": "Prophet (additive time-series: trend + weekly seasonality)",
        "horizon_days": horizon,
        "series": {},
    }

    for key in forecast_service.SERIES:
        try:
            # Cached models only — see forecast.predict's allow_training note.
            result = forecast_service.predict(horizon, series=key, allow_training=False)
        except Exception as exc:  # noqa: BLE001 - any failure is reportable
            logger.warning("Forecast unavailable for {}: {}", key, exc)
            out["series"][key] = {
                "available": False,
                "reason": str(exc),
            }
            continue

        forecast_rows = result.get("forecast", [])
        history_rows = result.get("history", [])
        predicted_total = sum(r["yhat"] for r in forecast_rows)
        recent_daily = [r["y"] for r in history_rows[-horizon:]] or [0.0]
        recent_avg = sum(recent_daily) / len(recent_daily)
        predicted_avg = predicted_total / len(forecast_rows) if forecast_rows else 0.0

        metrics = result.get("metrics") or {}
        out["series"][key] = {
            "available": True,
            "label": result.get("label", key),
            "unit": result.get("unit"),
            "predicted_total_next_period": round(predicted_total, 1),
            "predicted_daily_avg": round(predicted_avg, 1),
            "recent_daily_avg": round(recent_avg, 1),
            "direction": (
                "rising" if predicted_avg > recent_avg * 1.05
                else "falling" if predicted_avg < recent_avg * 0.95
                else "flat"
            ),
            # Width of the 85% interval — how uncertain the model is.
            "confidence_interval_pct": 85,
            "band_low_total": round(sum(r["yhat_lower"] for r in forecast_rows), 1),
            "band_high_total": round(sum(r["yhat_upper"] for r in forecast_rows), 1),
            "accuracy": {
                "mape_pct": metrics.get("mape"),
                "rmse": metrics.get("rmse"),
                "training_days": metrics.get("n_train"),
                "holdout_days": metrics.get("n_holdout"),
                "note": metrics.get("note"),
            },
            "trained_at": result.get("trained_at"),
            "history_days_available": len(history_rows),
        }

    return out


# ─── Building blocks ────────────────────────────────────────────────────────

def _period_totals(session, start: datetime, end: datetime) -> dict[str, Any]:
    row = session.execute(
        text(
            """
            SELECT
                COALESCE(SUM(amount)::float, 0) AS revenue,
                COUNT(*)                        AS order_count,
                COALESCE(AVG(amount)::float, 0) AS aov,
                COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
                COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
            FROM "DeliveryOrder"
            WHERE "createdAt" >= :start AND "createdAt" < :end
            """
        ),
        {"start": start, "end": end},
    ).one()
    return {
        "revenue": round(row.revenue, 2),
        "order_count": int(row.order_count),
        "aov": round(row.aov, 2),
        "delivered": int(row.delivered),
        "cancelled": int(row.cancelled),
    }


def _top_products(session, start: datetime, end: datetime, limit: int = 3) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
            SELECT
                p.name              AS name,
                p.unit              AS unit,
                SUM(o.quantity)     AS units,
                SUM(o.amount)::float AS revenue
            FROM "DeliveryOrder" o
            JOIN "Product" p ON p.id = o."productId"
            WHERE o."createdAt" >= :start AND o."createdAt" < :end
              AND o.status <> 'CANCELLED'
            GROUP BY p.name, p.unit
            ORDER BY revenue DESC
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit},
    ).all()
    return [
        {"name": r.name, "unit": r.unit, "units": int(r.units), "revenue": round(r.revenue, 2)}
        for r in rows
    ]


def _status_funnel(session, start: datetime, end: datetime) -> dict[str, int]:
    rows = session.execute(
        text(
            """
            SELECT status, COUNT(*) AS c
            FROM "DeliveryOrder"
            WHERE "createdAt" >= :start AND "createdAt" < :end
            GROUP BY status
            """
        ),
        {"start": start, "end": end},
    ).all()
    counts = {r.status: int(r.c) for r in rows}
    # Always present in the payload so the LLM's prompt has stable keys
    for key in ("PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED"):
        counts.setdefault(key, 0)
    return counts


def _driver_stats(session, start: datetime, end: datetime, limit: int = 5) -> list[dict[str, Any]]:
    """Per-driver delivery counts + average fulfilment time (order→delivered).

    Fulfilment time falls back to `updatedAt` when there is no explicit
    delivered timestamp — deliveryOrder.updatedAt reliably moves on any
    status change so it's a fair proxy for "delivered at" on DELIVERED rows.
    """
    rows = session.execute(
        text(
            """
            SELECT
                u.id                           AS driver_id,
                u.name                         AS driver_name,
                COUNT(o.*)                     AS assigned,
                COUNT(o.*) FILTER (WHERE o.status = 'DELIVERED') AS delivered,
                AVG(
                    EXTRACT(EPOCH FROM (o."updatedAt" - o."createdAt")) / 3600.0
                ) FILTER (WHERE o.status = 'DELIVERED')          AS avg_hours_to_deliver
            FROM "User" u
            JOIN "DeliveryOrder" o
                ON o."driverId" = u.id
               AND o."createdAt" >= :start AND o."createdAt" < :end
            WHERE u.role = 'DELIVERY'
            GROUP BY u.id, u.name
            HAVING COUNT(o.*) > 0
            ORDER BY delivered DESC, assigned DESC
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit},
    ).all()
    return [
        {
            # Note: driver_id and driver_name are considered PII and will be
            # stripped by the sanitiser before ever reaching the LLM.
            "driver_id": r.driver_id,
            "driver_name": r.driver_name,
            "assigned": int(r.assigned),
            "delivered": int(r.delivered),
            "avg_hours_to_deliver": (
                round(float(r.avg_hours_to_deliver), 2) if r.avg_hours_to_deliver is not None else None
            ),
        }
        for r in rows
    ]


def _pending_backlog(session) -> dict[str, int]:
    """How many orders are currently sitting in each open state, right now."""
    rows = session.execute(
        text(
            """
            SELECT status, COUNT(*) AS c
            FROM "DeliveryOrder"
            WHERE status IN ('PENDING', 'IN_TRANSIT')
            GROUP BY status
            """
        )
    ).all()
    counts = {r.status: int(r.c) for r in rows}
    return {"PENDING": counts.get("PENDING", 0), "IN_TRANSIT": counts.get("IN_TRANSIT", 0)}

# ─── Farm-side building blocks ──────────────────────────────────────────────
# Everything below reads LogEntry, the production logbook. None of it existed
# before, which is why the advisor could not answer a single question about
# eggs, mortality, feed or the growing environment.

# Average mass of one egg in kg, used to turn an egg COUNT into a MASS so that
# Feed Conversion Ratio is mass-over-mass and comparable to the industry
# benchmark. Mirrors AVG_EGG_MASS_KG in the Node analytics controller — keep
# the two in step.
AVG_EGG_MASS_KG = 0.06
FCR_BENCHMARK = 2.3


def _farm_totals(session, start: datetime, end: datetime) -> dict[str, Any]:
    """Totals and averages from the logbook for one window.

    Soft-deleted rows (deletedAt IS NOT NULL) are corrections and are excluded;
    counting them would double-count the day they correct.
    """
    row = session.execute(
        text(
            """
            SELECT
                COALESCE(SUM("eggsCount"), 0)::int           AS eggs,
                COALESCE(SUM("mortality"), 0)::int           AS mortality,
                COALESCE(SUM("feedConsumption"), 0)::float   AS feed_kg,
                COALESCE(SUM("waterConsumption"), 0)::float  AS water_l,
                AVG("temperature")::float                    AS avg_temperature_c,
                AVG("humidity")::float                       AS avg_humidity_pct,
                AVG("avgWeight")::float                      AS avg_bird_weight_kg,
                COUNT(DISTINCT date_trunc('day', "date"))::int AS days_logged,
                COUNT(*)::int                                AS entries
            FROM "LogEntry"
            WHERE "date" >= :start AND "date" < :end
              AND "deletedAt" IS NULL
            """
        ),
        {"start": start, "end": end},
    ).one()

    days = row.days_logged or 0
    eggs = int(row.eggs)
    feed_kg = round(float(row.feed_kg), 2)

    # FCR = kg feed per kg eggs. Null when no eggs were recorded, rather than
    # zero — zero would read as "perfectly efficient".
    egg_mass_kg = eggs * AVG_EGG_MASS_KG
    fcr = round(feed_kg / egg_mass_kg, 2) if egg_mass_kg > 0 else None

    def _round(v, nd=2):
        return None if v is None else round(float(v), nd)

    return {
        "eggs": eggs,
        "mortality": int(row.mortality),
        "feed_kg": feed_kg,
        "water_litres": round(float(row.water_l), 2),
        "days_logged": days,
        "entries_recorded": int(row.entries),
        # Per-DAY averages. Averaging raw rows instead would divide by the
        # number of batch entries, understating daily output several-fold.
        "eggs_per_day": round(eggs / days, 1) if days else None,
        "mortality_per_day": round(int(row.mortality) / days, 2) if days else None,
        "feed_kg_per_day": round(feed_kg / days, 2) if days else None,
        "avg_temperature_c": _round(row.avg_temperature_c, 1),
        "avg_humidity_pct": _round(row.avg_humidity_pct, 1),
        "avg_bird_weight_kg": _round(row.avg_bird_weight_kg, 3),
        "feed_conversion_ratio": fcr,
        "fcr_benchmark": FCR_BENCHMARK,
        "fcr_verdict": (
            None if fcr is None else "better" if fcr <= FCR_BENCHMARK else "worse"
        ),
    }


def _farm_daily(session, start: datetime, end: datetime, limit: int = 7) -> list[dict[str, Any]]:
    """One row per calendar day, newest last. Lets the model discuss trends
    and spot the specific bad day rather than only quoting a total."""
    rows = session.execute(
        text(
            """
            SELECT
                date_trunc('day', "date")::date              AS day,
                COALESCE(SUM("eggsCount"), 0)::int           AS eggs,
                COALESCE(SUM("mortality"), 0)::int           AS mortality,
                COALESCE(SUM("feedConsumption"), 0)::float   AS feed_kg,
                AVG("temperature")::float                    AS temperature_c
            FROM "LogEntry"
            WHERE "date" >= :start AND "date" < :end
              AND "deletedAt" IS NULL
            GROUP BY date_trunc('day', "date")
            ORDER BY day DESC
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit},
    ).all()

    return [
        {
            "day": r.day.isoformat(),
            "eggs": int(r.eggs),
            "mortality": int(r.mortality),
            "feed_kg": round(float(r.feed_kg), 2),
            "temperature_c": None if r.temperature_c is None else round(float(r.temperature_c), 1),
        }
        for r in reversed(rows)
    ]


def _inventory(session, low_stock_threshold: int = 20) -> dict[str, Any]:
    """Sellable stock, so the advisor can answer "are we about to run out?"."""
    rows = session.execute(
        text(
            """
            SELECT name, unit, stock::int AS stock, price::float AS price
            FROM "Product"
            WHERE "isActive" = true
            ORDER BY stock ASC
            """
        )
    ).all()

    products = [
        {"name": r.name, "unit": r.unit, "stock": int(r.stock), "price": round(float(r.price), 2)}
        for r in rows
    ]
    return {
        "active_products": len(products),
        "total_units_in_stock": sum(p["stock"] for p in products),
        "low_stock": [p for p in products if p["stock"] <= low_stock_threshold],
        "low_stock_threshold": low_stock_threshold,
        "products": products[:5],
    }
