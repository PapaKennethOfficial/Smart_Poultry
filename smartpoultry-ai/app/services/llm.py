"""Gemini wrapper for the two LLM-backed endpoints.

Design
    - Fail gracefully when GOOGLE_API_KEY is missing: return a structured
      "unavailable" object so the route can 503 with a friendly message.
    - Every prompt is templated with a single JSON blob of pre-sanitised
      metrics. The model is instructed to answer *only* from that blob so
      it can't invent numbers the user might act on.
    - Keep temperature low (0.2). We want steady, boring answers on a
      management dashboard — not creative writing.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from loguru import logger

from ..config import get_settings


# ─── Lazy import of google-genai ────────────────────────────────────────────
#   Only import when we actually have a key. Uses the new google-genai SDK
#   (not the deprecated google-generativeai) so protobuf 6 stays compatible
#   with OR-Tools 9.15.

def _configure_client():
    settings = get_settings()
    if not settings.google_api_key:
        return None, None
    try:
        from google import genai  # type: ignore
    except ImportError:
        logger.warning("google-genai is not installed; LLM insights disabled")
        return None, None
    client = genai.Client(api_key=settings.google_api_key)
    return client, settings.gemini_model


@dataclass
class LlmResult:
    ok: bool
    text: str
    model: str | None = None
    error: str | None = None


def _run_prompt(prompt: str) -> LlmResult:
    client, model_name = _configure_client()
    if client is None:
        return LlmResult(
            ok=False,
            text="",
            error=(
                "Gemini is not configured. Set GOOGLE_API_KEY in smartpoultry-ai/.env "
                "and restart the AI service."
            ),
        )
    try:
        # google-genai SDK: single-shot generation via client.models.generate_content
        # See https://ai.google.dev/gemini-api/docs/quickstart#python
        from google.genai import types  # type: ignore
        resp = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.9,
                max_output_tokens=512,
            ),
        )
        text = getattr(resp, "text", "") or ""
        return LlmResult(ok=True, text=text.strip(), model=model_name)
    except Exception as exc:  # pragma: no cover — network + auth errors
        logger.warning("Gemini call failed: {}", exc)
        return LlmResult(ok=False, text="", model=model_name, error=str(exc))


# ─── Prompts ────────────────────────────────────────────────────────────────

_MORNING_BRIEFING_SYSTEM = """
You are the SmartPoultry farm-operations analyst. You are writing a short
"morning briefing" for a farm manager in Ghana. The manager is not
technical: avoid jargon, avoid raw numbers where a ratio or a comparison
would be clearer.

Rules:
  1. Answer ONLY from the CONTEXT block. Do not invent numbers.
  2. If a value is null or missing, say so plainly — do NOT make one up.
  3. Keep the whole response to 3–5 short sentences.
  4. Lead with the single most important fact from the week.
  5. Use Ghana Cedi (GHS) for money. Round to whole numbers if > 1,000.
  6. Do not mention driver names, customer names, or personal contact
     details — the CONTEXT block deliberately omits them.
""".strip()


_ASK_THE_DATA_SYSTEM = """
You are the SmartPoultry farm-operations analyst. Answer the manager's
question using ONLY the numbers in the CONTEXT block.

Rules:
  1. If the answer is not in the CONTEXT, reply "I don't have that data
     for this week yet." — do not guess.
  2. Keep answers to 1–3 short sentences unless a list is genuinely needed.
  3. When comparing weeks, say the percentage change plainly (e.g. "up
     12% from last week"), never with technical wording like "delta".
  4. Do not mention driver names, customer names, or personal contact
     details — the CONTEXT deliberately omits them.
""".strip()


def _render_context_block(payload: dict[str, Any]) -> str:
    # Compact JSON so we don't burn tokens on whitespace.
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
