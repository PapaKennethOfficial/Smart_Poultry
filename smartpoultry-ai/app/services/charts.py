"""Per-chart data resolvers + descriptions, for the "Explain this chart" feature.

Why this file exists
    A manager looking at a scatter plot of driver hours does not necessarily
    know what they are looking at. Given the chart's ACTUAL current data plus a
    description of what the chart is for, an LLM can say what is happening in
    plain language.

Trust boundary
    The frontend sends only a chart id and a window. Everything the model sees
    is recomputed here, from the database. The browser never supplies the
    numbers, so a tampered client cannot feed the model made-up figures.

Reuse
    The same registry backs the printed PDF report, so an explanation in the
    document and an explanation on screen come from one definition.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from loguru import logger
from sqlalchemy import text

from ..db import get_session
from . import forecast as forecast_service
from . import metrics as metrics_service


# ─── Resolvers ──────────────────────────────────────────────────────────────
# Each returns a compact, JSON-safe dict. Keep them small: the model reads
# every byte, and a 60-row series costs more than it explains.


def _window(days: int) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    return now - timedelta(days=days), now


def egg_trend(days: int = 10) -> dict[str, Any]:
    start, end = _window(days)
    with get_session() as session:
        rows = metrics_service._farm_daily(session, start, end, limit=days)
        totals = metrics_service._farm_totals(session, start, end)
    return {
        "daily": rows,
        "total_eggs": totals["eggs"],
        "eggs_per_day": totals["eggs_per_day"],
        "days_logged": totals["days_logged"],
    }


def fcr_weekly(weeks: int = 6) -> dict[str, Any]:
    start, end = _window(weeks * 7)
    with get_session() as session:
        rows = session.execute(
            text(
                """
                SELECT
                    date_trunc('week', "date")::date            AS week,
                    COALESCE(SUM("feedConsumption"), 0)::float  AS feed_kg,
                    COALESCE(SUM("eggsCount"), 0)::int          AS eggs
                FROM "LogEntry"
                WHERE "date" >= :start AND "date" < :end AND "deletedAt" IS NULL
                GROUP BY date_trunc('week', "date")
                ORDER BY week ASC
                """
            ),
            {"start": start, "end": end},
        ).all()

    out = []
    for r in rows:
        egg_mass = int(r.eggs) * metrics_service.AVG_EGG_MASS_KG
        out.append(
            {
                "week_starting": r.week.isoformat(),
                "feed_kg": round(float(r.feed_kg), 2),
                "eggs": int(r.eggs),
                "fcr": round(float(r.feed_kg) / egg_mass, 2) if egg_mass > 0 else None,
            }
        )
    return {
        "weeks": out,
        "benchmark": metrics_service.FCR_BENCHMARK,
        "interpretation": "kg of feed per kg of eggs; LOWER is better",
    }


def fulfilment_funnel(days: int = 30) -> dict[str, Any]:
    start, end = _window(days)
    with get_session() as session:
        rows = session.execute(
            text(
                """
                SELECT status, "statusHistory"
                FROM "DeliveryOrder"
                WHERE "createdAt" >= :start AND "createdAt" < :end
                """
            ),
            {"start": start, "end": end},
        ).all()

    placed = confirmed = dispatched = delivered = 0
    for r in rows:
        placed += 1
        history = r.statusHistory if isinstance(r.statusHistory, list) else []
        seen = {h.get("status") for h in history if isinstance(h, dict)}
        seen.add(r.status)
        ever_dispatched = "IN_TRANSIT" in seen or "DELIVERED" in seen
        if ever_dispatched or "DRIVER_ASSIGNED" in seen:
            confirmed += 1
        if ever_dispatched:
            dispatched += 1
        if "DELIVERED" in seen:
            delivered += 1

    stages = [
        {"stage": "Placed", "count": placed},
        {"stage": "Confirmed", "count": confirmed},
        {"stage": "Dispatched", "count": dispatched},
        {"stage": "Delivered", "count": delivered},
    ]
    return {
        "stages": stages,
        "completion_rate_pct": round(delivered / placed * 100, 1) if placed else None,
        "biggest_dropoff": _biggest_dropoff(stages),
    }


def _biggest_dropoff(stages: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Where the funnel leaks worst — usually the one thing worth saying."""
    worst = None
    for a, b in zip(stages, stages[1:]):
        lost = a["count"] - b["count"]
        if a["count"] and (worst is None or lost > worst["lost"]):
            worst = {
                "from": a["stage"],
                "to": b["stage"],
                "lost": lost,
                "pct": round(lost / a["count"] * 100, 1),
            }
    return worst


def driver_efficiency(days: int = 30) -> dict[str, Any]:
    """Per-driver throughput. Names are deliberately omitted — drivers are
    labelled Driver 1..N by delivery count, so the chart can be described
    without identifying anyone."""
    start, end = _window(days)
    with get_session() as session:
        rows = session.execute(
            text(
                """
                SELECT
                    o."driverId"                AS driver_id,
                    COUNT(*)                    AS deliveries,
                    AVG(EXTRACT(EPOCH FROM (o."updatedAt" - o."createdAt")) / 3600.0) AS avg_hours
                FROM "DeliveryOrder" o
                WHERE o."createdAt" >= :start AND o."createdAt" < :end
                  AND o.status = 'DELIVERED' AND o."driverId" IS NOT NULL
                GROUP BY o."driverId"
                ORDER BY deliveries DESC
                """
            ),
            {"start": start, "end": end},
        ).all()

    drivers = [
        {
            "label": f"Driver {i + 1}",
            "deliveries": int(r.deliveries),
            "avg_hours_to_deliver": round(float(r.avg_hours), 2) if r.avg_hours is not None else None,
        }
        for i, r in enumerate(rows)
    ]
    times = [d["avg_hours_to_deliver"] for d in drivers if d["avg_hours_to_deliver"] is not None]
    return {
        "drivers": drivers,
        "driver_count": len(drivers),
        "fastest_hours": min(times) if times else None,
        "slowest_hours": max(times) if times else None,
        "note": "Driver names are withheld by policy; labels are ranked by volume.",
    }


def order_heatmap(days: int = 60) -> dict[str, Any]:
    start, end = _window(days)
    with get_session() as session:
        rows = session.execute(
            text(
                """
                SELECT
                    EXTRACT(DOW  FROM "createdAt")::int AS dow,
                    EXTRACT(HOUR FROM "createdAt")::int AS hour,
                    COUNT(*)                            AS c
                FROM "DeliveryOrder"
                WHERE "createdAt" >= :start AND "createdAt" < :end
                GROUP BY 1, 2
                ORDER BY c DESC
                """
            ),
            {"start": start, "end": end},
        ).all()

    names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    by_day: dict[str, int] = {n: 0 for n in names}
    by_hour: dict[int, int] = {}
    for r in rows:
        by_day[names[int(r.dow)]] += int(r.c)
        by_hour[int(r.hour)] = by_hour.get(int(r.hour), 0) + int(r.c)

    top = [
        {"day": names[int(r.dow)], "hour": int(r.hour), "orders": int(r.c)}
        for r in rows[:5]
    ]
    return {
        "busiest_slots": top,
        "orders_by_weekday": by_day,
        "busiest_weekday": max(by_day, key=by_day.get) if any(by_day.values()) else None,
        "busiest_hour": max(by_hour, key=by_hour.get) if by_hour else None,
        "quietest_weekday": min(by_day, key=by_day.get) if any(by_day.values()) else None,
    }


def revenue_timeseries(days: int = 30) -> dict[str, Any]:
    start, end = _window(days)
    with get_session() as session:
        rows = session.execute(
            text(
                """
                SELECT
                    date_trunc('day', "createdAt")::date AS day,
                    COALESCE(SUM(amount), 0)::float      AS revenue,
                    COUNT(*)                             AS orders
                FROM "DeliveryOrder"
                WHERE "createdAt" >= :start AND "createdAt" < :end
                  AND status <> 'CANCELLED'
                GROUP BY 1 ORDER BY 1 ASC
                """
            ),
            {"start": start, "end": end},
        ).all()
        totals = metrics_service._period_totals(session, start, end)

    daily = [
        {"day": r.day.isoformat(), "revenue": round(float(r.revenue), 2), "orders": int(r.orders)}
        for r in rows
    ]
    best = max(daily, key=lambda d: d["revenue"], default=None)
    return {
        "daily": daily,
        "total_revenue": totals["revenue"],
        "order_count": totals["order_count"],
        "avg_order_value": totals["aov"],
        "best_day": best,
        "currency": "GHS",
    }


def top_products(days: int = 30) -> dict[str, Any]:
    start, end = _window(days)
    with get_session() as session:
        rows = metrics_service._top_products(session, start, end, limit=8)
    total = sum(r["revenue"] for r in rows) or 1
    for r in rows:
        r["share_pct"] = round(r["revenue"] / total * 100, 1)
    return {"products": rows, "currency": "GHS"}


def demand_forecast(days: int = 14) -> dict[str, Any]:
    return forecast_service_summary("demand", days)


def egg_forecast(days: int = 14) -> dict[str, Any]:
    return forecast_service_summary("eggs", days)


def forecast_service_summary(series: str, horizon: int) -> dict[str, Any]:
    summary = metrics_service.forecast_summary(horizon=horizon)
    return {
        "model": summary["model"],
        "horizon_days": summary["horizon_days"],
        "detail": summary["series"].get(series, {"available": False, "reason": "Unknown series"}),
    }


def supply_vs_demand(days: int = 30) -> dict[str, Any]:
    """Eggs PRODUCED against eggs ORDERED, on one time axis, with both
    forecasts extending forward.

    This is the question a farm-plus-marketplace exists to answer and nothing
    else in the system answers it. Production lives in LogEntry, demand lives
    in DeliveryOrder, and until now the two halves shared a database and
    nothing else.
    """
    start, end = _window(days)

    with get_session() as session:
        rows = session.execute(
            text(
                """
                WITH produced AS (
                    SELECT date_trunc('day', "date")::date AS day,
                           SUM("eggsCount")::float         AS eggs
                    FROM "LogEntry"
                    WHERE "date" >= :start AND "date" < :end AND "deletedAt" IS NULL
                    GROUP BY 1
                ),
                ordered AS (
                    SELECT date_trunc('day', "deliveryDate")::date AS day,
                           SUM(quantity)::float                    AS units
                    FROM "DeliveryOrder"
                    WHERE "deliveryDate" >= :start AND "deliveryDate" < :end
                      AND status <> 'CANCELLED'
                    GROUP BY 1
                )
                SELECT COALESCE(p.day, o.day)      AS day,
                       COALESCE(p.eggs, 0)         AS produced,
                       COALESCE(o.units, 0)        AS ordered
                FROM produced p
                FULL OUTER JOIN ordered o ON p.day = o.day
                ORDER BY day ASC
                """
            ),
            {"start": start, "end": end},
        ).all()

    daily = [
        {
            "day": r.day.isoformat(),
            "produced": round(float(r.produced), 1),
            "ordered": round(float(r.ordered), 1),
            "surplus": round(float(r.produced) - float(r.ordered), 1),
        }
        for r in rows
    ]

    total_produced = sum(d["produced"] for d in daily)
    total_ordered = sum(d["ordered"] for d in daily)
    shortfall_days = [d for d in daily if d["surplus"] < 0]

    # Forward view: what each model expects next.
    forward = {}
    for key in ("eggs", "demand"):
        try:
            r = forecast_service.predict(14, series=key, allow_training=False)
            forward[key] = {
                "available": True,
                "degraded": r.get("degraded", False),
                "predicted_total_14d": round(sum(f["yhat"] for f in r["forecast"]), 1),
            }
        except Exception as exc:  # noqa: BLE001
            forward[key] = {"available": False, "reason": str(exc)}

    projected = None
    if forward.get("eggs", {}).get("available") and forward.get("demand", {}).get("available"):
        projected = round(
            forward["eggs"]["predicted_total_14d"] - forward["demand"]["predicted_total_14d"], 1
        )

    return {
        "daily": daily[-30:],
        "total_produced": round(total_produced, 1),
        "total_ordered": round(total_ordered, 1),
        "net_surplus": round(total_produced - total_ordered, 1),
        "coverage_pct": round(total_produced / total_ordered * 100, 1) if total_ordered else None,
        "days_short": len(shortfall_days),
        "worst_shortfall": min(daily, key=lambda d: d["surplus"]) if daily else None,
        "forecast_next_14d": forward,
        "projected_surplus_14d": projected,
        "note": "Production is counted in eggs; demand is counted in order units.",
    }


# ─── Registry ───────────────────────────────────────────────────────────────
# `what` and `how_to_read` are written FOR THE MODEL, so it can explain the
# chart to someone who has never seen one before.

CHARTS: dict[str, dict[str, Any]] = {
    "egg_trend": {
        "title": "Egg Collection — daily totals",
        "what": "Total eggs recorded in the logbook each day over the window.",
        "how_to_read": (
            "A line/area over time. Higher is more production. These are measured "
            "actuals, not predictions. Look for a sustained drop, which can signal "
            "illness, heat stress, feed problems or birds coming to end of lay."
        ),
        "resolver": egg_trend,
        "default_window": 10,
    },
    "fcr": {
        "title": "Feed Conversion Ratio by week",
        "what": "Kilograms of feed consumed per kilogram of eggs produced, weekly, against a benchmark line.",
        "how_to_read": (
            "LOWER IS BETTER — it means less feed for the same eggs. Bars below the "
            "benchmark line are good. A rising trend means efficiency is getting worse: "
            "feed waste, spillage, or birds eating more for the same output."
        ),
        "resolver": fcr_weekly,
        "default_window": 6,
        "window_unit": "weeks",
    },
    "fulfilment_funnel": {
        "title": "Order Fulfilment Funnel",
        "what": "How many orders reached each stage: Placed, Confirmed, Dispatched, Delivered.",
        "how_to_read": (
            "Each bar must be shorter than the one above it. The gap between two bars "
            "is where orders are being lost. The biggest gap is where to focus."
        ),
        "resolver": fulfilment_funnel,
        "default_window": 30,
    },
    "driver_efficiency": {
        "title": "Driver Efficiency",
        "what": "Each driver's delivered order count against their average hours per delivery.",
        "how_to_read": (
            "Points to the right = more deliveries. Points lower = faster. Bottom-right "
            "is best. A point far to the upper side is slow and worth investigating; it "
            "may mean a difficult route rather than a slow driver."
        ),
        "resolver": driver_efficiency,
        "default_window": 30,
    },
    "order_heatmap": {
        "title": "Peak Order Times",
        "what": "Order counts by weekday and hour of day.",
        "how_to_read": (
            "Darker cells mean more orders in that weekday/hour slot. Use it to decide "
            "when drivers need to be on shift and when to prepare stock."
        ),
        "resolver": order_heatmap,
        "default_window": 60,
    },
    "revenue_timeseries": {
        "title": "Revenue Over Time",
        "what": "Daily revenue and order count, cancelled orders excluded.",
        "how_to_read": (
            "Higher is more money taken that day, in Ghana Cedi. Watch the trend rather "
            "than any single day; single days are noisy."
        ),
        "resolver": revenue_timeseries,
        "default_window": 30,
    },
    "top_products": {
        "title": "Top Products by Revenue",
        "what": "Which products earned the most over the window, with each one's share.",
        "how_to_read": (
            "If one product is a very large share, the business is concentrated and "
            "exposed if that product has a supply problem."
        ),
        "resolver": top_products,
        "default_window": 30,
    },
    "supply_vs_demand": {
        "title": "Supply vs Demand",
        "what": (
            "Eggs produced on the farm against eggs ordered by customers, day "
            "by day, plus what each forecast expects over the next two weeks."
        ),
        "how_to_read": (
            "Two lines on one time axis. When the production line sits ABOVE "
            "the demand line the farm is making more than it sells, which ties "
            "up stock and risks spoilage. When it sits BELOW, orders cannot be "
            "filled and customers are turned away. `days_short` counts how many "
            "days demand exceeded production. `coverage_pct` above 100 means "
            "production covered demand overall for the period."
        ),
        "resolver": supply_vs_demand,
        "default_window": 30,
    },
    "demand_forecast": {
        "title": "AI Demand Forecast",
        "what": "Prophet's projection of customer order quantity, with an 85% confidence band.",
        "how_to_read": (
            "The solid line is what actually happened; the dashed line is the prediction; "
            "the shaded band is the range the model is 85% confident the real value will "
            "fall inside. A WIDER band means less certainty. mape_pct is how far off the "
            "model was on data it had not seen — lower is better."
        ),
        "resolver": demand_forecast,
        "default_window": 14,
    },
    "egg_forecast": {
        "title": "AI Egg Production Forecast",
        "what": "Prophet's projection of egg production, with an 85% confidence band.",
        "how_to_read": (
            "Same reading as the demand forecast. Comparing this against demand shows "
            "whether the farm is set to over- or under-produce."
        ),
        "resolver": egg_forecast,
        "default_window": 14,
    },
}


def resolve(chart_id: str, window: int | None = None) -> dict[str, Any]:
    """Return {spec, data} for a chart, or raise ValueError on an unknown id."""
    spec = CHARTS.get(chart_id)
    if spec is None:
        raise ValueError(
            f"Unknown chart {chart_id!r}. Known charts: {', '.join(sorted(CHARTS))}"
        )
    w = window if window is not None else spec["default_window"]
    try:
        data = spec["resolver"](w)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Chart resolver failed for {}: {}", chart_id, exc)
        raise RuntimeError(f"Could not load data for {chart_id}: {exc}") from exc

    return {
        "chart_id": chart_id,
        "title": spec["title"],
        "what": spec["what"],
        "how_to_read": spec["how_to_read"],
        "window": w,
        "window_unit": spec.get("window_unit", "days"),
        "data": data,
    }


def catalogue() -> list[dict[str, Any]]:
    """Everything explainable — lets the UI render buttons without hardcoding."""
    return [
        {
            "chart_id": key,
            "title": spec["title"],
            "default_window": spec["default_window"],
            "window_unit": spec.get("window_unit", "days"),
        }
        for key, spec in CHARTS.items()
    ]
