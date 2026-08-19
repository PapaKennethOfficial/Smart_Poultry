"""LLM-backed insights endpoints (morning briefing + ask-the-data)."""

import hashlib
import json
import os
import time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from pydantic import BaseModel, Field

from ..security import require_api_key
from ..services import llm as llm_service
from ..services import charts as charts_service
from ..services import metrics as metrics_service
from ..services import sanitizer


router = APIRouter(
    prefix="/api/v1/insights",
    tags=["insights"],
    dependencies=[Depends(require_api_key)],
)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    # The manager can widen the window: "how did last month go?" needs 30.
    days: int = Field(default=7, ge=1, le=365)


@router.post("/morning-briefing")
def morning_briefing(days: int = Query(default=7, ge=1, le=365)):
    """Generate an executive summary of the trailing `days`."""
    try:
        raw = metrics_service.weekly_snapshot(days=days)
    except Exception as exc:
        logger.warning("Metrics aggregation failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read metrics: {exc}",
        )

    payload = sanitizer.sanitize_weekly_snapshot(raw)
    result = llm_service.morning_briefing(payload)
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.error or "LLM unavailable",
        )
    return {
        "text": result.text,
        "model": result.model,
        "generated_at": raw["generated_at"],
        # Return the sanitised context so the caller can double-check what
        # the model actually saw. Useful for the "why did it say that?" tab.
        "context": payload,
    }


@router.post("/ask")
def ask(body: AskRequest):
    """Answer a plain-English question about the last 7 days of data."""
    question = sanitizer.sanitize_question(body.question)
    if not question:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Question was empty after sanitising")

    try:
        raw = metrics_service.weekly_snapshot(days=body.days)
    except Exception as exc:
        logger.warning("Metrics aggregation failed: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read metrics: {exc}",
        )

    payload = sanitizer.sanitize_weekly_snapshot(raw)
    result = llm_service.ask_the_data(question, payload)
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.error or "LLM unavailable",
        )
    return {
        "question": question,
        "answer": result.text,
        "model": result.model,
        "generated_at": raw["generated_at"],
        "window_days": raw["window"]["days"],
        # Returned so the UI can show "what the model actually saw".
        "context": payload,
    }


# ─── Explanation cache ───────────────────────────────────────────────────────
# An explanation is an LLM round trip: seconds, and it counts against a tight
# per-minute token budget. The same chart over the same window with unchanged
# data yields the same answer, so it is cached. Keyed on a hash of the actual
# resolved data, meaning the cache invalidates itself the moment the numbers
# move — no manual busting, no stale narration.
_EXPLANATION_CACHE: dict[str, dict] = {}
_CACHE_TTL_SECONDS = int(os.getenv("EXPLANATION_CACHE_TTL", "900"))  # 15 min
_CACHE_MAX_ENTRIES = 64


def _cache_key(chart_id: str, window: int | None, payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
    return f"{chart_id}:{window}:{digest}"


def _cache_get(key: str):
    hit = _EXPLANATION_CACHE.get(key)
    if not hit:
        return None
    if time.time() - hit["at"] > _CACHE_TTL_SECONDS:
        _EXPLANATION_CACHE.pop(key, None)
        return None
    return hit


def _cache_put(key: str, value: dict) -> None:
    if len(_EXPLANATION_CACHE) >= _CACHE_MAX_ENTRIES:
        oldest = min(_EXPLANATION_CACHE, key=lambda k: _EXPLANATION_CACHE[k]["at"])
        _EXPLANATION_CACHE.pop(oldest, None)
    _EXPLANATION_CACHE[key] = {**value, "at": time.time()}


class ExplainChartRequest(BaseModel):
    chart_id: str = Field(..., min_length=2, max_length=64)
    # Window length; unit depends on the chart (days for most, weeks for FCR).
    window: int | None = Field(default=None, ge=1, le=365)
    # Set true from a "Regenerate" button to bypass the cache.
    refresh: bool = False


@router.get("/charts")
def charts():
    """Which charts can be explained. Lets the UI avoid hardcoding ids."""
    return {"charts": charts_service.catalogue()}


@router.post("/explain-chart")
def explain_chart(body: ExplainChartRequest):
    """Explain one chart, using that chart's ACTUAL current data.

    The client sends only an id and a window — every number the model sees is
    recomputed here from the database, so a tampered client cannot feed the
    model invented figures.
    """
    try:
        context = charts_service.resolve(body.chart_id, body.window)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )

    payload = sanitizer.sanitize_chart_context(context)

    key = _cache_key(body.chart_id, body.window, payload)
    if not body.refresh:
        cached = _cache_get(key)
        if cached:
            return {
                "chart_id": body.chart_id,
                "title": context["title"],
                "window": context["window"],
                "window_unit": context["window_unit"],
                "explanation": cached["explanation"],
                "model": cached["model"],
                "cached": True,
                "context": payload,
            }

    result = llm_service.explain_chart(payload)
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.error or "LLM unavailable",
        )

    _cache_put(key, {"explanation": result.text, "model": result.model})

    return {
        "chart_id": body.chart_id,
        "title": context["title"],
        "window": context["window"],
        "window_unit": context["window_unit"],
        "explanation": result.text,
        "model": result.model,
        "cached": False,
        # Returned so the UI can offer "what the model actually saw".
        "context": payload,
    }


@router.get("/diagnostics")
def llm_diagnostics():
    """Why is the advisor failing? Returns the real provider error.

    Groq retires models on a rolling basis, so a name that worked last month
    can start returning 400 with no change on our side. This also lists what
    the account can actually call, which turns "it broke" into a fix.
    """
    import traceback
    from ..config import get_settings

    settings = get_settings()
    key = settings.groq_api_key or ""
    report = {
        "configured_model": settings.groq_model,
        "api_key_present": bool(key),
        "api_key_length": len(key),
        "api_key_prefix": key[:4] if key else None,
        "max_prompt_chars": llm_service._MAX_PROMPT_CHARS,
        "max_completion_tokens": llm_service._MAX_COMPLETION_TOKENS,
    }

    try:
        import groq
        report["groq_version"] = getattr(groq, "__version__", "unknown")
    except Exception as exc:
        report["groq_import_error"] = f"{type(exc).__name__}: {exc}"
        return report

    if not key:
        report["verdict"] = "GROQ_API_KEY is not set in smartpoultry-ai/.env"
        return report

    client = groq.Groq(api_key=key)

    # What can this account actually call right now?
    try:
        models = client.models.list()
        available = sorted(m.id for m in models.data)
        report["available_models"] = available
        report["configured_model_is_available"] = settings.groq_model in available
        # What the service will ACTUALLY call — the configured name is only a
        # preference, and it is substituted when the provider retires it.
        llm_service._resolved_model = None
        resolved = llm_service._resolve_model(client, settings.groq_model)
        report["resolved_model"] = resolved
        report["resolved_is_reasoning_model"] = llm_service._is_reasoning_model(resolved)
        report["reasoning_models_available"] = [
            m for m in available if llm_service._is_reasoning_model(m)
        ]
    except Exception as exc:
        report["models_list_error"] = f"{type(exc).__name__}: {exc}"

    # A deliberately tiny live call — isolates the provider from our payload.
    try:
        resp = client.chat.completions.create(
            model=report.get("resolved_model", settings.groq_model),
            messages=[{"role": "user", "content": "Reply with the single word: ok"}],
            max_tokens=5,
            temperature=0,
        )
        report["live_call"] = "ok"
        report["live_call_reply"] = (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        report["live_call"] = "FAILED"
        report["live_call_http_status"] = status_code
        report["live_call_error"] = f"{type(exc).__name__}: {exc}"
        report["live_call_traceback"] = traceback.format_exc().splitlines()[-6:]

    return report
