"""Weekly-metrics aggregator used by the LLM insights endpoints.

Everything the Gemini model ever sees comes from this file. Keeping the
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


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


# ─── The public entry point ─────────────────────────────────────────────────

def weekly_snapshot(reference: datetime | None = None) -> dict[str, Any]:
    """Aggregate KPIs for the trailing 7 days ending at `reference` (UTC now).

    Returns a schema documented in prompts/morning_briefing.py so the model
    always sees the same keys. Missing data becomes explicit `null`s so the
    prompt can say "we didn't record that" rather than hallucinating.
    """
    now = (reference or datetime.now(timezone.utc)).replace(microsecond=0)
    week_start = now - timedelta(days=7)
    prev_week_start = week_start - timedelta(days=7)

    with get_session() as session:
        current = _period_totals(session, week_start, now)
        previous = _period_totals(session, prev_week_start, week_start)
        top_products = _top_products(session, week_start, now)
        status_funnel = _status_funnel(session, week_start, now)
        driver_stats = _driver_stats(session, week_start, now)
        pending_backlog = _pending_backlog(session)

    return {
        "generated_at": now.isoformat(),
        "window": {
            "start": week_start.isoformat(),
            "end": now.isoformat(),
            "days": 7,
        },
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
    }


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
