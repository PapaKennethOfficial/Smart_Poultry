# Running SmartPoultry with Docker

Four services, one command. This document covers a local run, which is what the
defence demo needs.

```
┌─ localhost:8080 ─┐  nginx  ─┐
│  Customer PWA    │          │
└──────────────────┘          │   /api, /uploads, /socket.io
                              ├──────────────────────────────► backend:5000 ──┐
┌─ localhost:8081 ─┐  nginx  ─┘                                   │           │
│  Admin console   │                                              │           │
└──────────────────┘                                              ▼           ▼
                                                             ai:8000     postgres:5432
                                                          (not published)  (host 5433)
```

---

## 1. First run

```bash
cp .env.docker.example .env
```

Open `.env` and fill in the values at the top. Compose refuses to start without
the first three, by design:

| Variable | Generate with |
|---|---|
| `POSTGRES_PASSWORD` | anything you like |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `AI_SERVICE_API_KEY` | `openssl rand -base64 48` |
| `ADMIN_PASSWORD` | anything you like (only used when seeding) |

Then:

```bash
docker compose up --build
```

The first build takes a while - Prophet installs its Stan backend and both
frontends run a full Vite build. Later builds reuse the cached layers.

When it settles:

- **http://localhost:8080** - customer / driver PWA
- **http://localhost:8081** - manager admin console
- **http://localhost:5000** - API directly
- **localhost:5433** - postgres (5433, not 5432, so it cannot collide with a
  postgres already installed on your machine)

## 2. Seed demo data

An empty database means empty charts. To populate one, set `RUN_SEED=true` for
a single run:

```bash
RUN_SEED=true docker compose up backend
# then set it back to false, or every restart writes more demo rows
```

## 3. Train the forecasting models

Prophet has nothing to predict from until it is fitted. Once there is data:

```bash
curl -X POST http://localhost:5000/api/ai/retrain \
     -H "Authorization: Bearer <a manager JWT>"
```

Check it worked:

```bash
curl http://localhost:5000/api/ai/diagnostics -H "Authorization: Bearer <jwt>"
```

`engine` must read `prophet`. If it says `naive` the fallback is active - the
image build would normally have caught that (see section 7), so investigate
rather than shipping it.

---

## 4. Everyday commands

```bash
docker compose up -d              # start in the background
docker compose logs -f backend    # follow one service
docker compose ps                 # health of everything
docker compose restart backend    # restart one service
docker compose down               # stop, keep the data
docker compose down -v            # stop and DELETE the database and uploads
```

`down -v` destroys the `pgdata`, `uploads` and `ai_models` volumes. There is no
undo.

### Changing a frontend variable

Vite inlines every `VITE_*` value into the bundle at **build** time. Editing
`.env` and restarting does nothing - you must rebuild:

```bash
docker compose up --build pwa admin
```

This is the single most common thing to trip over. If Maps autocomplete or
Google sign-in is dead after editing `.env`, this is why.

---

## 5. What runs where

| Service | Image base | Host port | Notes |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5433 | Volume `pgdata` |
| `ai` | `python:3.12-slim` | - | Not published. Backend is its only caller |
| `backend` | `node:22-bookworm-slim` | 5000 | Volume `uploads` |
| `pwa` | `nginx:1.27-alpine` | 8080 | Static bundle + API proxy |
| `admin` | `nginx:1.27-alpine` | 8081 | Static bundle + API proxy |

The AI service is not published to the host on purpose. It holds no auth of its
own beyond a shared `X-API-Key`, and the Node backend is the only thing that
should ever call it.

---

## 6. Design notes

**Why each frontend has its own nginx.** Serving the bundle and proxying `/api`
from one origin is what lets the frontend use relative `/api/...` URLs. No CORS
preflight, no API base URL baked into the bundle, and the JWT travels on
requests the browser treats as first-party.

**Why Socket.IO gets its own nginx block.** The `Upgrade` and `Connection`
headers are what turn the HTTP request into a WebSocket. Without them Socket.IO
silently degrades to long-polling and live tracking crawls. The read timeout is
raised to an hour because a tracking socket is idle between position updates and
nginx's 60-second default would tear it down every minute.

**Why the service worker is marked no-cache.** A cached service worker pins
users to an old build permanently: you deploy, and nobody ever receives it.

**Why migrations run in an entrypoint, not a separate service.** `prisma
migrate deploy` only applies migrations that are already committed - it never
generates or resets - so it is safe on every boot, including against a database
that is already current. Running it in the backend's entrypoint means the API
cannot start before its schema exists.

**Why `depends_on: ai: condition: service_healthy`.** `service_started` only
proves the container process launched. Uvicorn takes several seconds more to
bind, and the backend's first forecast call would hit an open-but-unserved port.

**Why the AI service uses one uvicorn worker.** Each worker is a separate
process with its own model cache and its own Stan process pool. Two of them
double the memory a Prophet fit needs for no throughput gain at this volume.

**Why the prisma CLI stays in the runtime image.** `schema.prisma` has no `url`
in its datasource block - Prisma 7 reads it from `prisma.config.ts` - so both
the CLI and that config file must be present at runtime for `migrate deploy`,
not just at build time.

---

## 7. The Prophet build check

The AI image fits a 30-point Prophet model during the build and fails if it does
not get a usable forecast back.

This is deliberate. Prophet degrades quietly: when its Stan backend cannot load,
the service catches the error and falls back to a naive projection **while still
answering HTTP 200**. That is exactly the failure that shipped silently in this
project once already - the cached model files were 100 bytes of
`NAIVE_FALLBACK` and every endpoint looked fine.

A failed build is a much better outcome than a forecast that isn't one.

---

## 8. Optional integrations

All of these are off by default and the app degrades rather than crashing.

### Firebase Admin (server-side Google Sign-In)

Needs the project id **and** a service-account file mounted into the backend.
Add to the `backend` service in `docker-compose.yml`:

```yaml
    volumes:
      - uploads:/app/uploads
      - ./smartpoultry-backend/firebase-adminsdk.json:/run/secrets/firebase.json:ro
```

and in `.env`:

```
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase.json
```

Without both, Google sign-in is disabled and the button says so. Email/password
sign-in is unaffected.

### Groq (AI advisor)

Set `GROQ_API_KEY`. Without it the morning briefing, Ask-the-Data and per-chart
explanations return 503 with a clear message. Forecasting and every chart still
work - only the narration is gone.

### Email and SMS

`SMTP_*` for password-reset mail, `TWILIO_*` or `SMS_*` for OTP delivery. Both
optional.

---

## 9. Troubleshooting

**Compose exits immediately with `set POSTGRES_PASSWORD in .env`.** Working as
intended - a required secret is missing. Fill in the values in section 1.

**Backend restarts in a loop.** `docker compose logs backend`. Usually a
migration failure; the entrypoint prints which one.

**Port already allocated.** Something on your machine holds 8080, 8081, 5000 or
5433. Change the corresponding `*_HOST_PORT` in `.env`. If you change
`PWA_HOST_PORT` or `ADMIN_HOST_PORT`, update `SOCKET_ALLOWED_ORIGINS` to match
or live tracking will refuse the connection.

**Charts are empty.** The database has no data. See section 2.

**Forecast says "naive".** Prophet's Stan backend did not load. Rebuild the AI
image without cache: `docker compose build --no-cache ai`.

**Live tracking never connects.** Check the browser console for a Socket.IO
origin rejection, then confirm the page's origin appears in
`SOCKET_ALLOWED_ORIGINS`.

**A frontend `.env` change did nothing.** See section 4 - `VITE_*` needs a
rebuild.
