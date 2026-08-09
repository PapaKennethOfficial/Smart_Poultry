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

The two Gemini-backed endpoints (Morning Briefing, AI Advisor) need a Google API key set in your local `.env`. Without it those two endpoints return a friendly `503`; everything else works.

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
| Morning Briefing returns truncated fragments | Daily Gemini free-tier quota exhausted — switch to a higher-quota model in `smartpoultry-ai/.env` or wait for the quota window to reset |
| Vite dev server can't resolve `/src/main.jsx` | Always `cd` into the app folder before `npm run dev` — the `--prefix` flag doesn't set the working directory the compiler expects |

---

## 8. Repo layout

```
Smart_Poultry/
├── smartpoultry-backend/     # Express + Prisma + Postgres. Cron for weekly retrain.
├── smartpoultry-admin/       # Vite + React — manager dashboard
├── smartpoultry-pwa/         # Vite + React — customer + driver mobile app
├── smartpoultry-ai/          # FastAPI — Prophet, OR-Tools, Gemini
└── docker-compose.yml        # One-command local Postgres + AI service
```

Both frontends proxy `/api/*` to the backend. The AI service is called by the backend only, never by the browser directly.

---

Questions or corrections? Open an issue or ping the team channel.
