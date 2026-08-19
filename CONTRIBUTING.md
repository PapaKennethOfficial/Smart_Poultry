# Contributing to SmartPoultry

Everything you need to run the stack locally and open a pull request.

> **Security first.** Every value in `.env.example` is a placeholder. Choose your own strong passwords, secrets, and API keys — never commit real credentials, and never reuse the example values in a shared or deployed environment.

---

## 1. Prerequisites

| Tool | Purpose |
|---|---|
| **Node.js 20+** | Backend + both frontends |
| **Python 3.11 – 3.14** | AI microservice |
| **PostgreSQL 15+** | Application database |
| **Git** | Source control |

Optional but handy: **GitHub CLI** (`gh`) for opening PRs from the terminal.

---

## 2. First-time setup

### 2a. Fork and clone

Fork the repo on GitHub, then:

```bash
git clone https://github.com/<your-github-username>/Smart_Poultry.git
cd Smart_Poultry
git remote add upstream https://github.com/PapaKennethOfficial/Smart_Poultry.git
```

### 2b. Install dependencies

```bash
cd smartpoultry-backend && npm install
cd ../smartpoultry-admin && npm install
cd ../smartpoultry-pwa && npm install
cd ..
```

### 2c. Create the database

In pgAdmin or `psql`:

```sql
CREATE DATABASE smartpoultry_db;
```

### 2d. Configure environment variables

```bash
cp smartpoultry-backend/.env.example smartpoultry-backend/.env
cp smartpoultry-ai/.env.example      smartpoultry-ai/.env
```

Open each `.env` file and replace every placeholder with your own value. In particular:

- `DATABASE_URL` — your local Postgres connection string.
- `JWT_SECRET` — a long, random string generated locally (e.g. `openssl rand -hex 32`). Never reuse across environments.
- Any `ADMIN_PASSWORD` or similar seed value — pick something only you know.

If your backend runs on a non-default port, mirror it in `smartpoultry-admin/.env.local` and `smartpoultry-pwa/.env.local`:

```
VITE_API_PROXY_TARGET=http://localhost:<your backend port>
```

### 2e. Sync the database schema and seed

```bash
cd smartpoultry-backend
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:seed          # optional — creates the seeded admin + demo products
```

The seed script uses the credentials you set in `.env`. **Change the seeded admin password immediately after first login**, or delete the seeded admin entirely before shipping to any shared environment.

### 2f. AI microservice

```bash
cd smartpoultry-ai
python -m venv .venv
.venv\Scripts\activate           # Windows PowerShell
# source .venv/bin/activate      # Mac / Linux
pip install -r requirements.txt
```

The LLM-backed endpoints (Morning Briefing, AI Advisor, Explain-this-chart) need a Groq API key (`GROQ_API_KEY`) set in your local `.env`. Without it those two endpoints return a friendly `503`; everything else works.

---

## 3. Running the stack

Four terminals, one per service. Ports come from your `.env` — the examples use 5001 / 5173 / 5174 / 8000.

```bash
# backend
cd smartpoultry-backend && npm run dev

# admin dashboard
cd smartpoultry-admin && npm run dev

# customer + driver PWA
cd smartpoultry-pwa && npm run dev

# AI microservice
cd smartpoultry-ai
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

Sign in with the account created by your seed script (whatever email/password you chose in `.env`), or self-register a customer or delivery account through the UI.

---

## 3a. Testing the running stack

The full stack has three real flows worth walking through — auth, ordering, and the customer↔driver live-tracking map. All commands below assume the four dev servers from §3 are running.

### End-to-end flow (browser)

1. **Sign in as a manager** at `http://localhost:5173/admin/login`. Confirm the Dashboard renders KPI cards and the Analytics page shows the Sales Tracker.
2. **Register a driver** at `http://localhost:5174/register` → pick the Delivery Staff tab. On first login they'll land on `/delivery/vehicle` — submit vehicle details (Truck / Van / Motorcycle; photos required).
3. **Approve the vehicle** as the manager: `/admin/dashboard/verify-vehicles` → change status to APPROVED. The driver's dashboard now switches to "Assigned Deliveries".
4. **Register a customer** at `http://localhost:5174/register` → Customer tab. Log in → land on `/customer/marketplace` → add a product to cart → checkout with your address. The order is auto-assigned to any driver whose vehicle is APPROVED and who has fewest active jobs.
5. **As the driver**, open `/delivery/orders`, tap the new order → **Start Delivery** to move it to IN_TRANSIT. The browser starts sending GPS updates every 5–10 s.
6. **As the customer**, open `/customer/orders`, tap the same order → live map appears with a **green destination pin**, a **car icon for the driver**, a line between them and a haversine distance label. The car updates as the driver moves.
7. **As the driver**, mark the order Delivered. The customer's live map disappears (server clears `driverLatitude/Longitude` on any terminal state).

### API smoke tests (terminal)

Substitute `<TOKEN>` with the value returned by `/api/auth/login` for whichever role the endpoint requires.

```bash
# Health
curl -s http://localhost:5001/

# Auth
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<your-manager-email>","password":"<your-password>","role":"MANAGER"}'

# Sales Tracker (Manager)
curl -s http://localhost:5001/api/analytics/sales-tracker?days=30 \
  -H "Authorization: Bearer <TOKEN>"

# Prophet demand forecast (Manager) — first call may take ~3 s while the model trains,
# subsequent calls hit the joblib cache and return in <200 ms.
curl -s http://localhost:5001/api/ai/forecast/demand?days=14 \
  -H "Authorization: Bearer <TOKEN>"

# Force a Prophet retrain (Manager) — refits on latest DeliveryOrder history
# and reports MAPE / RMSE / MAE on the holdout window.
curl -s -X POST http://localhost:5001/api/ai/forecast/retrain \
  -H "Authorization: Bearer <TOKEN>"

# OR-Tools route optimisation (Manager) — pass a list of order IDs and get an
# ordered stop sequence per vehicle.
curl -s -X POST http://localhost:5001/api/ai/routes/optimize \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"orderIds":["<order-id-1>","<order-id-2>"]}'

# Morning Briefing from Gemini (Manager) — returns friendly 503 if GOOGLE_API_KEY missing.
curl -s -X POST http://localhost:5001/api/ai/insights/morning-briefing \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"days":7}'
```

### Google Maps: customer ↔ driver live tracking

The map only wakes up when an order is in **IN_TRANSIT** state. To see it end-to-end:

1. Have an approved driver logged in on **`http://localhost:5174/delivery/orders`** (a browser window). Grant location permission when the browser asks.
2. Have a customer with an active order logged in on **another window** at `http://localhost:5174/customer/orders`. Open the order details.
3. The driver taps **Start Delivery** on the assigned order — the button toggles state to IN_TRANSIT and the driver's browser starts `navigator.geolocation.watchPosition` PATCHing coordinates to `/api/orders/:id/location`.
4. The customer's order-detail map re-polls every ~10 s via TanStack Query; the **blue car icon** moves toward the **green destination pin** with the polyline recalculated each tick.
5. Mark the order Delivered on the driver side. The customer's live map hides itself (backend clears the driver coordinates on any terminal transition).

If the driver's coordinates don't reach the customer:
- Backend log will show `PATCH /api/orders/:id/location -> 400` if the order isn't IN_TRANSIT (that guard is intentional).
- Browser console on the customer side may show a Google Maps `ApiNotActivatedMapError` — enable the "Maps JavaScript API" for your key in the Google Cloud Console.
- If both sides show 200s but nothing moves, refresh the customer window — service-worker cache from `vite-plugin-pwa` occasionally serves a stale bundle.

### Full build check before opening a PR

```bash
cd smartpoultry-backend && npm run build   # if applicable
cd ../smartpoultry-admin  && npm run build
cd ../smartpoultry-pwa    && npm run build
```

All three should exit with `built in Ns` and no red output.

---

## 4. Optional: Google Sign-In (Firebase)

Skip this if you're happy with email + password locally. If you want the "Continue with Google" button working:

**Every contributor uses their own Firebase project.** Never share Firebase Admin JSON files — that JSON is a private key that acts as admin over the whole project.

1. Create a project at <https://console.firebase.google.com>.
2. Add a Web App → copy the `firebaseConfig` values → paste into `smartpoultry-pwa/.env.local` as `VITE_FIREBASE_*` variables (names are listed in the placeholder file).
3. Enable **Google** in Authentication → Sign-in method.
4. Project Settings → Service Accounts → Generate new private key → download the JSON. Save it under `smartpoultry-backend/` (the filename is already covered by `.gitignore`).
5. Point `GOOGLE_APPLICATION_CREDENTIALS` in `smartpoultry-backend/.env` at the absolute path of that JSON.
6. Restart the backend and pwa dev servers.

One design rule to know: a Google account can hold multiple SmartPoultry accounts — one per role. Clicking Continue with Google on the Customer tab creates (or reuses) the customer account for that identity; clicking on the Delivery tab creates (or reuses) the delivery account. The two coexist.

---

## 5. Optional: viewing the app on your phone

Localhost on your PC isn't reachable from the phone. Two ways to bridge:

### Same Wi-Fi (fastest, no signup)
Find your PC's Wi-Fi IPv4 address (`ipconfig` on Windows), restart the pwa dev server with `npm run dev -- --host 0.0.0.0`, then open `http://<your-pc-ip>:5174` in the phone's address bar. Windows Firewall may prompt — allow it for Private networks. Google Sign-In will refuse plain IPs — that's a Firebase constraint, not ours.

### Public HTTPS tunnel (works from anywhere)
Install cloudflared once (`winget install --id Cloudflare.cloudflared`), then run `cloudflared tunnel --url http://localhost:5174`. Copy the `https://*.trycloudflare.com` URL from its output. If you want Google Sign-In to work through it, add that URL to your Firebase project's Authorized Domains once. The URL changes each restart — re-add each time or move to a named tunnel with your own domain if you outgrow it.

---

## 6. Development workflow

- Branch off `upstream/main`: `git checkout main && git pull upstream main && git checkout -b feat/<short-name>`.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) — see recent `git log` for tone.
- Before opening a PR: run `npm run build` in every folder you touched, smoke-test the flow in a browser, and rebase / merge in the latest `upstream/main`.
- Open PRs against `PapaKennethOfficial/Smart_Poultry:main`. Include a short summary and how to test.
- **Never commit** secrets, `.env` files, service-account JSONs, or personal keys. `.gitignore` catches the common ones — verify with `git status` before every commit.

---

## 7. Common pitfalls

| Symptom | Fix |
|---|---|
| Backend errors after pulling schema changes | `npx prisma generate && npx prisma db push --accept-data-loss` |
| Frontend shows "Google Sign-In unavailable" | Firebase env vars aren't set — see §4, or ignore and use email + password |
| Frontend Google Maps loader complains about mismatched options | Your `VITE_GOOGLE_MAPS_API_KEY` isn't set in the pwa `.env.local` |
| Morning Briefing / AI Advisor returns 503 | Google API key missing in `smartpoultry-ai/.env` |
| Morning Briefing returns truncated fragments | Groq free-tier quota exhausted, or `GROQ_MODEL` names a decommissioned model — check the service log for the exact Groq error |
| Vite dev server can't resolve `/src/main.jsx` | Always `cd` into the app folder before `npm run dev` — the `--prefix` flag doesn't set the working directory the compiler expects |

---

## 8. Repo layout

```
Smart_Poultry/
├── smartpoultry-backend/     # Express + Prisma + Postgres. Cron for weekly retrain.
├── smartpoultry-admin/       # Vite + React — manager dashboard
├── smartpoultry-pwa/         # Vite + React — customer + driver mobile app
├── smartpoultry-ai/          # FastAPI — Prophet, OR-Tools, Groq
└── docker-compose.yml        # One-command local Postgres + AI service
```

Both frontends proxy `/api/*` to the backend. The AI service is called by the backend only, never by the browser directly.

---

Questions or corrections? Open an issue or ping the team channel.
