"""Groq LLM wrapper for the two LLM-backed endpoints.

Design
    - Fail gracefully when GROQ_API_KEY is missing.
    - Every prompt is templated with a single JSON blob of pre-sanitised metrics.
    - Keep temperature low (0.2). We want steady, boring answers.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from loguru import logger

from ..config import get_settings


# Groq retires models on a rolling basis. `llama-3.1-8b-instant` was live when
# this service was written and later started returning
#   404 - The model does not exist or you do not have access to it
# with no change on our side. Hardcoding a replacement only moves the failure
# to a future date, so the model is RESOLVED against what the account can
# actually call, with a preference order.
#
# Order matters: small and fast first, since every call here is a short
# narration over pre-computed numbers, not a reasoning task.
# Plain chat models first. Reasoning-style models (gpt-oss, qwen3) spend their
# token budget thinking and can return an empty `content`, which is exactly how
# the Supply vs Demand explanation came back blank with no error.
_PREFERRED_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
]

# Reasoning-style families. These stream a scratchpad and can either leave
# `content` empty or, worse, emit the scratchpad itself. They are excluded from
# automatic selection — a user may still pin one explicitly via GROQ_MODEL.
_REASONING_MARKERS = ("gpt-oss", "qwen3", "deepseek", "-r1", "reasoning", "thinking")


def _is_reasoning_model(model_id: str) -> bool:
    lowered = model_id.lower()
    return any(marker in lowered for marker in _REASONING_MARKERS)


# Phrases that only appear when a model is thinking out loud rather than
# answering. Cheap, and it catches the failure before the manager sees it.
_DELIBERATION_MARKERS = (
    "we need to produce",
    "we need to",
    "let's craft",
    "let me craft",
    "the user wants",
    "we must not",
    "we should mention",
    "wait,",
    "actually,",
    "so we can mention",
    "let's check",
)


def _looks_like_deliberation(text: str) -> bool:
    head = text[:400].lower()
    hits = sum(1 for m in _DELIBERATION_MARKERS if m in head)
    # Two or more markers in the opening is decisive; one alone could be prose.
    return hits >= 2


# Resolution is cached for the process; a 404 clears it and forces a re-resolve.
_resolved_model: str | None = None


def _list_available(client) -> list[str]:
    try:
        return sorted(m.id for m in client.models.list().data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not list Groq models: {}", exc)
        return []


def _resolve_model(client, configured: str) -> str:
    """Pick a model the account can actually call.

    Falls back to the configured name when the list cannot be fetched, so a
    transient listing failure never blocks a call that would have worked.
    """
    global _resolved_model
    if _resolved_model:
        return _resolved_model

    available = _list_available(client)
    if not available:
        _resolved_model = configured
        return _resolved_model

    if configured in available:
        _resolved_model = configured
    else:
        pick = next((m for m in _PREFERRED_MODELS if m in available), None)
        if pick is None:
            # Nothing preferred is offered. Take the first plain chat model,
            # skipping audio, safety and reasoning families — an auto-selected
            # reasoning model is what emitted a scratchpad into the UI.
            pick = next(
                (
                    m for m in available
                    if not any(k in m.lower() for k in ("whisper", "tts", "guard"))
                    and not _is_reasoning_model(m)
                ),
                None,
            )
        if pick is None:
            pick = configured  # nothing usable; let the call fail with a real error
        logger.warning(
            "GROQ_MODEL '{}' is not available on this account; falling back to '{}'. "
            "Set GROQ_MODEL in smartpoultry-ai/.env to silence this.",
            configured, pick,
        )
        _resolved_model = pick

    return _resolved_model


def _configure_client():
    settings = get_settings()
    if not settings.groq_api_key:
        return None, None
    try:
        import groq  # type: ignore
    except ImportError:
        logger.warning("groq is not installed; LLM insights disabled")
        return None, None
    client = groq.Groq(api_key=settings.groq_api_key)
    return client, _resolve_model(client, settings.groq_model)


@dataclass
class LlmResult:
    ok: bool
    text: str
    model: str | None = None
    error: str | None = None


# Groq's free "on_demand" tier caps TOKENS PER MINUTE, not per request — the
# observed limit is 6,000 TPM. A single call must therefore stay well under
# that so a manager can ask more than one question a minute, and so the
# morning briefing and an advisor question can coexist.
#
# Budget: ~2,500 prompt tokens. At roughly 4 characters per token that is
# 10,000 characters. Override with LLM_MAX_PROMPT_CHARS if you upgrade tier.
_MAX_PROMPT_CHARS = int(os.getenv("LLM_MAX_PROMPT_CHARS", "10000"))
_MAX_COMPLETION_TOKENS = int(os.getenv("LLM_MAX_COMPLETION_TOKENS", "700"))


def _run_prompt(prompt: str) -> LlmResult:
    if len(prompt) > _MAX_PROMPT_CHARS:
        msg = (
            f"The question needed {len(prompt):,} characters of context, over the "
            f"{_MAX_PROMPT_CHARS:,} limit set for this API tier. Try a shorter "
            "window (for example the last 7 days)."
        )
        logger.warning(msg)
        return LlmResult(ok=False, text="", error=msg)

    logger.info("LLM prompt: {} chars (~{} tokens)", len(prompt), len(prompt) // 4)
    client, model_name = _configure_client()
    if client is None:
        return LlmResult(
            ok=False,
            text="",
            error=(
                "Groq is not configured. Set GROQ_API_KEY in smartpoultry-ai/.env "
                "and restart the AI service."
            ),
        )
    def _call(model: str):
        return client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            top_p=0.9,
            max_tokens=_MAX_COMPLETION_TOKENS,
        )

    try:
        try:
            resp = _call(model_name)
        except Exception as first:
            # A model can be retired between one request and the next. If that
            # is what happened, drop the cached choice, re-resolve against the
            # live list, and try once more before giving up.
            status = getattr(getattr(first, "response", None), "status_code", None)
            if status != 404:
                raise
            global _resolved_model
            logger.warning("Model '{}' returned 404; re-resolving.", model_name)
            _resolved_model = None
            settings = get_settings()
            model_name = _resolve_model(client, settings.groq_model)
            resp = _call(model_name)

        choice = resp.choices[0]
        msg = choice.message
        text = (getattr(msg, "content", None) or "").strip()

        finish = getattr(choice, "finish_reason", None)

        # Deliberately NOT falling back to `message.reasoning`. A reasoning
        # model's scratchpad is not an answer — surfacing it printed a page of
        # "We need to produce 2-4 short sentences... Wait, today refers to..."
        # into the explanation panel. An honest failure beats that.
        if text and _looks_like_deliberation(text):
            detail = (
                f"Model '{model_name}' returned its internal reasoning instead of "
                "an answer. Set GROQ_MODEL in smartpoultry-ai/.env to a plain chat "
                "model (see GET /api/v1/insights/diagnostics for the list)."
            )
            logger.warning(detail)
            return LlmResult(ok=False, text="", model=model_name, error=detail)

        if not text:
            # NEVER return ok=True with nothing in it. That produced an
            # "explanation" panel that opened, showed no error, and stayed
            # blank — the least debuggable possible outcome.
            hint = (
                "the model hit its output limit before writing an answer"
                if finish == "length"
                else f"the model returned an empty response (finish_reason={finish})"
            )
            detail = (
                f"No explanation was produced: {hint}. "
                f"Model '{model_name}'. Try again, or set GROQ_MODEL in "
                "smartpoultry-ai/.env to a non-reasoning chat model."
            )
            logger.warning(detail)
            return LlmResult(ok=False, text="", model=model_name, error=detail)

        if finish == "length":
            logger.info("LLM output truncated at the token limit (model={})", model_name)

        return LlmResult(ok=True, text=text, model=model_name)
    except Exception as exc:  # pragma: no cover
        # Surface the model name in the message: a decommissioned GROQ_MODEL
        # is the most common cause of a 400 here, and the bare SDK error does
        # not always say which model was requested.
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        if status_code == 404:
            detail = (
                f"The AI provider no longer offers model '{model_name}'. "
                "Providers retire models on a rolling basis. Check "
                "GET /api/v1/insights/diagnostics for the current list and set "
                "GROQ_MODEL in smartpoultry-ai/.env."
            )
        elif status_code in (413, 429):
            detail = (
                "The AI provider's rate limit was hit (free tier allows about "
                "6,000 tokens per minute). Wait a moment and try again, ask about "
                "a shorter window, or upgrade the Groq plan."
            )
        else:
            detail = f"Groq call failed (model={model_name}"
            if status_code:
                detail += f", http {status_code}"
            detail += f"): {exc}"
        logger.warning(detail)
        return LlmResult(ok=False, text="", model=model_name, error=detail)


# ─── Prompts ────────────────────────────────────────────────────────────────

_MORNING_BRIEFING_SYSTEM = """
You are the SmartPoultry farm-operations analyst. You are writing a short
"morning briefing" for a farm manager in Ghana. The manager is not
technical: avoid jargon, avoid raw numbers where a ratio or a comparison
would be clearer.

The CONTEXT covers BOTH halves of the business:
  * farm_current / farm_previous / farm_daily — eggs collected, mortality,
    feed and water use, temperature, humidity, feed conversion ratio
  * current_week / previous_week / top_products / status_funnel — orders,
    revenue, fulfilment
  * inventory — what is in stock and what is running low
  * forecasts — the Prophet models for order demand and egg production

Rules:
  1. Answer ONLY from the CONTEXT block. Do not invent numbers.
  2. If a value is null or missing, say so plainly — do NOT make one up.
  3. Keep the whole response to 3-5 short sentences.
  4. Lead with the single most important fact of the period. A mortality
     spike or a stock-out beats a good revenue number.
  5. Use Ghana Cedi (GHS) for money. Round to whole numbers if > 1,000.
  6. Do not mention driver names, customer names, or personal contact
     details — the CONTEXT block deliberately omits them.
  7. window.days tells you how long the period is. Say "this week" only if
     it is 7; otherwise say "the last N days".
""".strip()


_ASK_THE_DATA_SYSTEM = """
You are the SmartPoultry operations analyst. Answer using ONLY the CONTEXT.

CONTEXT KEYS
  farm_current / farm_daily : eggs, mortality, feed kg, water, temperature,
      humidity, feed_conversion_ratio (LOWER is better; use fcr_verdict).
      farm_daily is one row per day.
  current_week / previous_week / week_over_week / top_products /
  status_funnel / pending_backlog / driver_stats : orders, revenue, AOV,
      fulfilment stages, per-driver counts (no names).
  inventory : stock levels and low-stock items.
  forecasts : Prophet models. Per series (demand = orders, eggs = production):
      predicted_total_next_period, direction, the 85% band, and
      accuracy.mape_pct = average percent error on unseen data (lower better).
      If available is false, say the model is untrained and give `reason`.

RULES
  1. Never invent a number. If it is not in CONTEXT, say what you do have
     that is closest, then say what is missing.
  2. 1-3 short sentences unless a list is genuinely needed. No jargon.
  3. Money is Ghana Cedi (GHS); round above 1,000.
  4. Never name drivers or customers — CONTEXT omits them deliberately. If
     asked who is best, say names are withheld and give the counts.
  5. window.days is the period. Only call it "this week" if it is 7.
  6. Asked how the forecast works: it is a Prophet time-series model that
     learns the trend plus a weekly pattern from recent records and projects
     forward. Quote horizon, predicted total, direction, and mape_pct.
""".strip()


_EXPLAIN_CHART_SYSTEM = """
You are the SmartPoultry farm-operations analyst. A farm manager in Ghana is
looking at ONE chart on their dashboard and wants to know what it is telling
them. Many managers have never had to read a chart before — assume no prior
knowledge, and never assume they know what an axis, a trend line or a
confidence band is.

The CONTEXT gives you:
  title         what the chart is called on screen
  what          what it measures
  how_to_read   how this chart type should be interpreted, and which
                direction is good
  window        how much time the chart covers
  data          the ACTUAL numbers currently plotted

Write 2-4 short sentences, in this order:
  1. What the chart is showing, in everyday words.
  2. What it is showing RIGHT NOW — quote the specific numbers from `data`.
     Name the standout: the best day, the worst day, the biggest gap.
  3. Whether that is good or bad, and if something needs attention, what to
     do about it. If everything looks normal, say so plainly.

Rules:
  1. Use ONLY the numbers in CONTEXT. Never invent a figure.
  2. No jargon. Do not say "trend line", "variance", "delta", "correlation"
     or "confidence interval" without immediately explaining it in plain words.
  3. Money is Ghana Cedi (GHS). Round above 1,000.
  4. Never mention driver names, customer names or contact details — the
     CONTEXT omits them on purpose.
  5. If `data` is empty or every value is zero, say the chart has no data yet
     and what needs to be recorded to populate it. Do not invent a story.
  6. Do not describe the colours or the shape of the drawing. Describe what
     the numbers mean for the farm.
""".strip()


def explain_chart(chart_context: dict[str, Any]) -> LlmResult:
    prompt = (
        f"{_EXPLAIN_CHART_SYSTEM}\n\n"
        f"CONTEXT (JSON):\n{_render_context_block(chart_context)}\n\n"
        f"Explain this chart now."
    )
    return _run_prompt(prompt)


def _render_context_block(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def morning_briefing(sanitized_metrics: dict[str, Any]) -> LlmResult:
    prompt = (
        f"{_MORNING_BRIEFING_SYSTEM}\n\n"
        f"CONTEXT (JSON):\n{_render_context_block(sanitized_metrics)}\n\n"
        f"Write the briefing now."
    )
    return _run_prompt(prompt)


def ask_the_data(question: str, sanitized_metrics: dict[str, Any]) -> LlmResult:
    prompt = (
        f"{_ASK_THE_DATA_SYSTEM}\n\n"
        f"CONTEXT (JSON):\n{_render_context_block(sanitized_metrics)}\n\n"
        f"MANAGER QUESTION: {question}\n\n"
        f"Answer:"
    )
    return _run_prompt(prompt)
