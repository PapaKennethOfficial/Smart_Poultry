"""LLM-backed insights endpoints (morning briefing + ask-the-data)."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

from ..security import require_api_key
from ..services import llm as llm_service
from ..services import metrics as metrics_service
from ..services import sanitizer


router = APIRouter(
    prefix="/api/v1/insights",
    tags=["insights"],
    dependencies=[Depends(require_api_key)],
)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


@router.post("/morning-briefing")
def morning_briefing():
    """Generate an executive summary of the trailing 7 days."""
    try:
        raw = metrics_service.weekly_snapshot()
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
        raw = metrics_service.weekly_snapshot()
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
    }
