# SmartPoultry AI microservice — Python 3.12 slim image with Prophet + OR-Tools.
# Multi-stage: builder installs everything with build tools, runtime keeps only
# the site-packages so the final image stays small.

FROM python:3.12-slim AS builder
WORKDIR /build

# Prophet's cmdstanpy needs a C++ toolchain to install Stan; OR-Tools needs a
# handful of shared libs. Install them only in the builder stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first so the pip layer caches on rebuilds when only source changes
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --prefix=/install --no-cache-dir -r requirements.txt

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime
WORKDIR /app

# libpq for psycopg2 at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy the installed Python packages from the builder
COPY --from=builder /install /usr/local

# Application source
COPY app ./app
COPY .env.example .env.example

# Non-root user for defence in depth
RUN useradd --create-home --shell /bin/bash ai \
 && chown -R ai:ai /app
USER ai

EXPOSE 8000

# Prod-style uvicorn command; disable reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
