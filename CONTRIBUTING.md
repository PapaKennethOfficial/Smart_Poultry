# Contributing to SmartPoultry

Everything you need to get your local machine up and running with the same stack the team uses, plus the conventions we follow when opening pull requests.

---

## 1. Prerequisites

Install these before anything else. Rough sizes for planning:

| Tool | Why we need it | Windows install |
|---|---|---|
| **Node.js 20+** | Backend + both frontends | https://nodejs.org (pick the LTS installer) |
| **Python 3.11 – 3.14** | AI microservice (Prophet + OR-Tools + Gemini) | https://www.python.org/downloads/ — tick **"Add python.exe to PATH"** |
| **PostgreSQL 15+** | Everything reads/writes here | https://www.postgresql.org/download/windows/ — remember the `postgres` superuser password you set |
| **Git** | Obvious | https://git-scm.com/download/win |
| **GitHub CLI** (optional but nice) | For `gh pr create` etc. | `winget install --id GitHub.cli` |

On Mac / Linux use `brew install` or your package manager. Same tools, same versions.

---

## 2. First-time setup (~10 min)

### 2a. Clone the fork you'll push to

Fork `PapaKennethOfficial/Smart_Poultry` on GitHub first, then:

```bash
git clone https://github.com/<your-github-username>/Smart_Poultry.git
cd Smart_Poultry
git remote add upstream https://github.com/PapaKennethOfficial/Smart_Poultry.git
```

`origin` = your fork (you push here). `upstream` = the main repo (you pull from here, PRs go here).

### 2b. Install node dependencies in all three JS folders

```bash
cd smartpoultry-backend && npm install
cd ../smartpoultry-admin && npm install
cd ../smartpoultry-pwa && npm install
cd ..
```

### 2c. Create the Postgres database

Open **pgAdmin** (or `psql`) and run once:

```sql
CREATE DATABASE smartpoultry_db;
```

### 2d. Create `.env` files from the examples

```bash
cp smartpoultry-backend/.env.example smartpoultry-backend/.env
cp smartpoultry-ai/.env.example      smartpoultry-ai/.env
```

Edit **`smartpoultry-backend/.env`** and set at minimum:

```
DATABASE_URL="postgresql://postgres:<YOUR_POSTGRES_PASSWORD>@localhost:5432/smartpoultry_db"
JWT_SECRET=any-random-string-32+chars
ADMIN_PASSWORD=123456
PORT=5001
```

For the admin dashboard, if your backend runs on `:5001` instead of the default `:5000`, also create **`smartpoultry-admin/.env.local`** with:

```
VITE_API_PROXY_TARGET=http://localhost:5001
```

Same file for the pwa: `smartpoultry-pwa/.env.local`.

### 2e. Migrate the database and seed test data

```bash
cd smartpoultry-backend
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:seed          # optional — creates the admin user + some products
```

The `db push` step is important. The schema has columns (`avatarUrl`, `isTwoFactorEnabled`, `otpCode`, `otpExpiry`) that were added without a formal migration file. Login 500s until you sync them once.

### 2f. Set up the Python AI microservice venv

```bash
cd smartpoultry-ai
python -m venv .venv
.venv\Scripts\activate           # Windows PowerShell
# source .venv/bin/activate      # Mac / Linux
pip install -r requirements.txt
```

The `Gemini` LLM panels (Morning Briefing, AI Advisor) need a free Google API key — get one at https://aistudio.google.com/apikey and paste it into `smartpoultry-ai/.env`:

```
GOOGLE_API_KEY=AIza...
```

The forecast, route optimiser, and everything else in the AI service work fine without it. If the key is missing you'll just get a friendly `503 "Gemini not configured"` when you hit the two LLM endpoints.

---

## 3. Running the stack (4 terminals)

Open a terminal for each and leave them running:

```bash
# terminal 1 — backend
cd smartpoultry-backend && npm run dev
# → http://localhost:5001

# terminal 2 — admin dashboard (Manager portal)
cd smartpoultry-admin && npm run dev
# → http://localhost:5173

# terminal 3 — customer + driver PWA
cd smartpoultry-pwa && npm run dev
# → http://localhost:5174

# terminal 4 — AI microservice
cd smartpoultry-ai
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

### 3a. Sign in

Manager portal (http://localhost:5173/admin/login):
- `admin@smartpoultry.com` / `123456`

Customer / Delivery pwa (http://localhost:5174/login): pick tab, then either use an account you register through the UI, or one of the seeded accounts (see `smartpoultry-backend/prisma/seed.js`).

---

## 4. Optional: Google Sign-In (Firebase)

The "Continue with Google" buttons on the pwa need Firebase configured. Skip this section if you're happy using email + password for local dev — everything else works without it.

Each contributor uses **their own** Firebase project (never share credentials — the admin JSON is a private key that acts as admin on the whole project).

1. Sign in at https://console.firebase.google.com → **Add project** → any name → skip Analytics.
2. Once the project loads, click the **`</>`** icon to **Add a Web App** → register → **copy the `firebaseConfig` object** you're shown.
3. In the left sidebar → **Authentication** → **Get started** → **Sign-in method** tab → enable **Google** → save.
4. In the left sidebar → gear icon → **Project settings** → **Service accounts** tab → **Generate new private key** → downloads a JSON file. Save it as **`smartpoultry-backend/firebase-adminsdk.json`** (already gitignored, will not be committed).
5. Add to **`smartpoultry-pwa/.env.local`**:

   ```
   VITE_FIREBASE_API_KEY=<from step 2>
   VITE_FIREBASE_AUTH_DOMAIN=<from step 2>
   VITE_FIREBASE_PROJECT_ID=<from step 2>
   VITE_FIREBASE_STORAGE_BUCKET=<from step 2>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<from step 2>
   VITE_FIREBASE_APP_ID=<from step 2>
   ```

6. Add to **`smartpoultry-backend/.env`** (use the absolute path to where you saved the JSON):

   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\Smart_Poultry\smartpoultry-backend\firebase-adminsdk.json
   ```

7. Restart the backend and pwa dev servers. The "Continue with Google" button should now be enabled.

**One Firebase rule to know:** Google Sign-In is tied to a role. If you first sign in on the Delivery tab with a Google account, that account is a `DELIVERY` account forever. Clicking Customer tab with the same account will return 403 with a clear message telling you which tab to use.

---

## 5. Optional: Testing on your phone

Your phone can't reach `http://localhost:5174` — that's localhost on the phone, not your PC. You need to either:

### Option A — Same Wi-Fi (fastest, no signup)

1. Find your PC's Wi-Fi IP: `ipconfig` → look for **Wireless LAN adapter Wi-Fi → IPv4 Address**.
2. Restart the pwa dev server with `--host`: `npm run dev -- --host 0.0.0.0`
3. On your phone (same Wi-Fi), open `http://<YOUR-PC-IP>:5174` in Chrome's **address bar** (not Google search).
4. If Windows Firewall prompts, click **Allow** for Private networks.

Works for browsing the site. **Google Sign-In won't work from an IP address** — Firebase requires a real domain in its Authorized Domains list.

### Option B — Cloudflare Quick Tunnel (public HTTPS URL, works on any network)

1. Install cloudflared once: `winget install --id Cloudflare.cloudflared`
2. Run:
   ```bash
   "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5174
   ```
3. Copy the `https://*.trycloudflare.com` URL from its output. Open it on your phone.
4. If you want Google Sign-In to work through it, add that URL to your Firebase project's Authorized Domains (Console → Authentication → Settings → Authorized domains → Add domain).

**The URL changes every time you restart cloudflared.** You'll need to re-add the new subdomain to Firebase each time. For a URL that survives restarts, you'd need to buy a ~$10/yr domain and set up a "named tunnel" — overkill for demo work.

---

## 6. Development workflow

### Branches

- Never commit directly to `main`. Always work on a feature branch off `upstream/main`.
- Naming: `feat/<short-description>` (e.g. `feat/order-review-modal`) or `fix/<short-description>` (e.g. `fix/driver-map-crash`).

### Before you start on something new

```bash
git checkout main
git pull upstream main       # get the latest
git checkout -b feat/my-thing
```

### Commit style

Follow the pattern already in the log — [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add password strength meter to register form

Explains the WHY, not the WHAT. Bullet points if the change touches
multiple files or has non-obvious behaviour.
```

Types we use: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`, `test`.

### Before opening a PR

1. **Run the production build** in the folder you touched — catches import errors and lint issues in one shot:
   ```bash
   npm run build
   ```
2. **Smoke-test the actual flow** in a browser. If your change is on the driver side, log in as a driver and click through it. Screenshots in the PR body are appreciated for UI changes.
3. **Rebase or merge upstream/main** if it's moved since you branched:
   ```bash
   git fetch upstream
   git merge upstream/main       # or `git rebase upstream/main` if you prefer a clean history
   ```
4. Push to your fork:
   ```bash
   git push origin feat/my-thing
   ```
5. Open the PR against `PapaKennethOfficial/Smart_Poultry:main`. Include:
   - What changed and why (1–3 bullet points)
   - How to test it (steps)
   - Any DB migrations or new env vars a reviewer needs to know about

---

## 7. Common pitfalls (things that will bite you once)

| Symptom | Cause | Fix |
|---|---|---|
| Login returns 500, backend log mentions `P2022` / `ColumnNotFound` on `User` | The schema has columns the DB doesn't. Happens after pulling schema changes. | `cd smartpoultry-backend && npx prisma db push --accept-data-loss` |
| Backend errors say `Unknown field 'review' for include statement on model 'DeliveryOrder'` | Prisma client is stale | `cd smartpoultry-backend && npx prisma generate`, then restart backend |
| Vite dev server error: `Failed to load url /src/main.jsx` (paths that contain spaces) | Vite tripping over a `--prefix` invocation | Always `cd` into the app folder before `npm run dev` — don't invoke npm with `--prefix` |
| pwa page shows `Loader must not be called again with different options` (Google Maps) | `VITE_GOOGLE_MAPS_API_KEY` missing from `smartpoultry-pwa/.env.local` | Add it (ask a team member for the key or generate your own free key at https://console.cloud.google.com) and restart the pwa dev server |
| Google Sign-In → 403 with a message about wrong tab | Working as designed — Google accounts are pinned to one role | Click the tab that matches the role your Google account was first registered with |
| Morning Briefing/AI Advisor return `503` | `GOOGLE_API_KEY` missing from `smartpoultry-ai/.env` | Get a free key at https://aistudio.google.com/apikey, set it, restart the AI service |
| Morning Briefing returns truncated fragments | Free-tier daily Gemini quota hit (20 requests/day on `gemini-3.6-flash`) | Wait until midnight PT for quota reset, OR set `GEMINI_MODEL=gemini-flash-lite-latest` in `smartpoultry-ai/.env` for a ~1000/day quota |

---

## 8. Repo layout at a glance

```
Smart_Poultry/
├── smartpoultry-backend/     # Express + Prisma + Postgres. Also runs the Prophet retrain cron.
├── smartpoultry-admin/       # Vite + React — the manager dashboard (:5173)
├── smartpoultry-pwa/         # Vite + React — customer + driver mobile app (:5174)
├── smartpoultry-ai/          # FastAPI microservice — Prophet, OR-Tools, Gemini (:8000)
├── docker-compose.yml        # Optional one-command local Postgres + AI service
└── README.md                 # Product-level overview
```

Both `smartpoultry-admin` and `smartpoultry-pwa` proxy `/api/*` requests to the backend, so the frontends and backend all share one HTTP origin from the browser's perspective. The backend calls the AI service internally with an `X-API-Key` header — the AI service is never exposed to the browser.

---

Questions? Ping the team channel or open an issue. Something in this doc that's stale? PR it.
