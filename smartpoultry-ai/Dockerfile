# ─────────────────────────────────────────────────────────────────────────────
#  SmartPoultry AI microservice — FastAPI + Prophet + OR-Tools
#
#  Multi-stage: the builder carries the C++ toolchain Prophet's cmdstanpy and
#  psycopg2 need to install; the runtime keeps only the resulting packages.
#
#  The Prophet smoke test in the builder is not ceremony. Prophet degrades
#  quietly: when its Stan backend cannot load, the service catches the error
#  and falls back to a naive projection while still answering HTTP 200. That
#  exact failure shipped silently once already. Fitting a tiny model at build
#  time turns it into a failed build instead of a forecaster that isn't one.
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Requirements first so the pip layer caches across source-only rebuilds.
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --prefix=/install --no-cache-dir -r requirements.txt

# ─── Prophet self-check ─────────────────────────────────────────────────────
# Fit a 30-point series and require a real forecast back. If the Stan binary is
# missing, unreadable or built for another architecture, this fails here rather
# than at 2am in front of a panel.
ENV PYTHONPATH=/install/lib/python3.12/site-packages
RUN python - <<'PYCHECK'
import sys
import pandas as pd
from prophet import Prophet

frame = pd.DataFrame({
    "ds": pd.date_range("2024-01-01", periods=30, freq="D"),
    "y": [10 + (i % 7) for i in range(30)],
})

model = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=False)
model.fit(frame)
forecast = model.predict(model.make_future_dataframe(periods=7))

if len(forecast) != 37 or forecast["yhat"].isna().any():
    sys.exit("Prophet produced an unusable forecast - refusing to build this image.")

print(f"Prophet OK - {len(forecast)} forecast rows from a 30-point series.")
PYCHECK

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# libpq5 for psycopg2, libgomp1 for OR-Tools' OpenMP runtime, curl for the
# healthcheck below.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY app ./app
COPY .env.example .env.example

# The cache directory has to exist and be writable before the volume mounts,
# otherwise the first retrain fails on a read-only path.
RUN mkdir -p /app/app/models/cache \
 && useradd --create-home --shell /bin/bash --uid 10002 ai \
 && chown -R ai:ai /app
USER ai

EXPOSE 8000

# main.py exposes /health unauthenticated (the "meta" tag); every other route
# sits behind the X-API-Key check, so a probe could not use one.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# One worker, not two. Each uvicorn worker is a separate process with its own
# in-memory model cache and its own Stan process pool; two of them double the
# memory a Prophet fit needs for no throughput gain at this request volume.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
