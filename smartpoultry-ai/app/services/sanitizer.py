"""PII sanitisation before payloads are sent to the LLM.

Strategy
    Whitelist, not blacklist. The metrics aggregator returns a fixed
    schema (see services/metrics.py); this file mirrors that schema and
    only lets safe fields through. Any key that isn't explicitly
    whitelisted is dropped — even if new fields are added to the
    aggregator later, they won't accidentally leak to the LLM.

Additionally the string contents are scrubbed for common patterns
(email, phone, GPS coords, cuid IDs) as a defence in depth.

The farm, inventory and forecast blocks added alongside the sales metrics
carry no personal data by construction — birds, eggs, feed, air temperature,
product stock and model accuracy. Driver and customer identity remain
excluded, so "who is my fastest driver" is still unanswerable by design.
"""

from __future__ import annotations

import re
from typing import Any


# ─── Regex-based scrubbers (defence in depth) ───────────────────────────────

_PATTERNS = [
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[email]"),
    # International phones — must start with `+` so we don't accidentally
    # match ISO dates like "2026-07-18T13:44:55+00:00" (the earlier version
    # of this pattern greedily matched date fragments and corrupted every
    # timestamp we send to the LLM).
    (re.compile(r"\+\d[\d\s\-()]{6,}\d"), "[phone]"),
    # Ghanaian mobile shape: 0 followed by 9–10 digits, e.g. 0551470803.
    (re.compile(r"\b0\d{9,10}\b"), "[phone]"),
    # cuid identifiers Prisma generates ("cmr4veov40000g0i3281qy3z5")
    (re.compile(r"\bc[a-z0-9]{24,}\b"), "[id]"),
    # Plausible lat/lon pairs like "5.6037, -0.1870"
    (
        re.compile(r"-?\d{1,3}\.\d{3,},\s*-?\d{1,3}\.\d{3,}"),
        "[coords]",
    ),
]


def _scrub_string(value: str) -> str:
    out = value
    for pattern, repl in _PATTERNS:
        out = pattern.sub(repl, out)
    return out


# ─── Whitelist for the weekly-snapshot schema ───────────────────────────────

_FARM_TOTALS_FIELDS = {
    "eggs",
    "mortality",
    "feed_kg",
    "water_litres",
    "days_logged",
    "entries_recorded",
    "eggs_per_day",
    "mortality_per_day",
    "feed_kg_per_day",
    "avg_temperature_c",
    "avg_humidity_pct",
    "avg_bird_weight_kg",
    "feed_conversion_ratio",
    "fcr_benchmark",
    "fcr_verdict",
}

# Per-series forecast description. No customer or driver identity appears in
# any of these — they are model metadata and aggregate predictions.
_FORECAST_SERIES_FIELDS = {
    "available",
    "reason",
    "label",
    "unit",
    "predicted_total_next_period",
    "predicted_daily_avg",
    "recent_daily_avg",
    "direction",
    "confidence_interval_pct",
    "band_low_total",
    "band_high_total",
    "accuracy",
    "trained_at",
    "history_days_available",
}

_WEEKLY_SNAPSHOT_WHITELIST: dict[str, Any] = {
    "generated_at": True,
    "window": {"start": True, "end": True, "days": True},
    "current_week": {"revenue", "order_count", "aov", "delivered", "cancelled"},
    "previous_week": {"revenue", "order_count", "aov", "delivered", "cancelled"},
    "week_over_week": {"revenue_change_pct", "order_change_pct", "aov_change_pct"},
    "top_products": [{"name", "unit", "units", "revenue"}],
    "status_funnel": {"PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED"},
    "driver_stats": [{"assigned", "delivered", "avg_hours_to_deliver"}],
    #  ↑ driver_id and driver_name are intentionally NOT in the whitelist.
    "pending_backlog": {"PENDING", "IN_TRANSIT"},

    # ── Farm side ──────────────────────────────────────────────────────────
    # Logbook data carries no personal information: it is birds, eggs, feed
    # and air temperature. The whole block is safe to pass through.
    "farm_current": _FARM_TOTALS_FIELDS,
    "farm_daily": [{"day", "eggs", "mortality", "feed_kg", "temperature_c"}],
    "farm_change": {"eggs_change_pct", "mortality_change_pct", "feed_change_pct"},

    # ── Inventory ──────────────────────────────────────────────────────────
    # Product names and stock levels only — no customer attached.
    "inventory": {
        "active_products": True,
        "total_units_in_stock": True,
        "low_stock": [{"name", "unit", "stock", "price"}],
        "low_stock_threshold": True,
        "products": [{"name", "unit", "stock", "price"}],
    },

    # ── Model state ────────────────────────────────────────────────────────
    "forecasts": {
        "model": True,
        "horizon_days": True,
        "series": {
            "demand": _FORECAST_SERIES_FIELDS,
            "eggs": _FORECAST_SERIES_FIELDS,
        },
    },
}


def _apply_whitelist(node: Any, spec: Any) -> Any:
    # spec is one of:
    #   True         → keep the value as-is
    #   set[str]     → dict with only these keys allowed
    #   [set|dict]   → list; apply the inner spec to each item
    #   dict         → nested dict spec
    if spec is True:
        return node
    if isinstance(spec, set):
        if not isinstance(node, dict):
            return {}
        return {k: node[k] for k in node if k in spec}
    if isinstance(spec, list):
        if not isinstance(node, list) or not spec:
            return []
        inner = spec[0]
        return [_apply_whitelist(item, inner) for item in node]
    if isinstance(spec, dict):
        if not isinstance(node, dict):
            return {}
        out = {}
        for key, sub in spec.items():
            if key in node:
                out[key] = _apply_whitelist(node[key], sub)
        return out
    return None


def sanitize_weekly_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of `snapshot` with only whitelisted keys and PII-scrubbed strings."""
    cleaned = _apply_whitelist(snapshot, _WEEKLY_SNAPSHOT_WHITELIST)
    return _scrub_strings_recursive(cleaned)


def _scrub_strings_recursive(node: Any) -> Any:
    if isinstance(node, str):
        return _scrub_string(node)
    if isinstance(node, list):
        return [_scrub_strings_recursive(x) for x in node]
    if isinstance(node, dict):
        return {k: _scrub_strings_recursive(v) for k, v in node.items()}
    return node


# ─── Free-text sanitisation (for the "Ask the Data" question) ───────────────

_MAX_QUESTION_LEN = 500


def sanitize_question(text: str) -> str:
    """Trim, cap length, and remove obvious PII from a user's free-text query."""
    if not isinstance(text, str):
        return ""
    trimmed = text.strip()[:_MAX_QUESTION_LEN]
    return _scrub_string(trimmed)


# ─── Chart-explanation context ──────────────────────────────────────────────

def sanitize_chart_context(context: Any) -> Any:
    """Scrub a chart context before it reaches the LLM.

    Unlike the weekly snapshot there is no fixed key whitelist here: chart
    payloads differ in shape by design, and every resolver in services/charts.py
    is written to emit aggregates only — driver labels are "Driver 1..N", never
    names. The regex scrubbers still run as defence in depth, so an email,
    phone number, cuid or GPS pair that somehow reached a resolver is stripped
    rather than forwarded.
    """
    return _scrub_strings_recursive(context)
