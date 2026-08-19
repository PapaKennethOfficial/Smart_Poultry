# Getting in sync after this branch merges

For collaborators pulling `feat/auth-hardening-ui-refresh-docker`.

There are two routes. **Docker** is one command and needs nothing installed but
Docker itself. **Manual** matches how the app has been run so far. Pick one.

---

## 0. First, the line-ending change (everyone, once)

This branch adds `.gitattributes`. Without it a Windows checkout rewrites every
file to CRLF and the next commit shows ~190 files as fully modified, burying
the real diff. After pulling, normalise your working copy once:

```bash
git config core.autocrlf true      # Windows only
git add --renormalize .
git status                          # should be clean; if not, commit the result
```

If `git status` looks chaotic after a pull, this is why — run the above.

---

## 1. Nothing secret comes from git

Four files are deliberately **not** in the repo and each person creates their
own. Every one has a committed `.env.example` beside it:

| Create this | From | Holds |
|---|---|---|
| `smartpoultry-backend/.env` | `.env.example` | DB URL, `JWT_SECRET`, `AI_SERVICE_API_KEY`, `ADMIN_PASSWORD` |
| `smartpoultry-ai/.env` | `.env.example` | DB URL, `AI_SERVICE_API_KEY`, `GROQ_API_KEY` |
| `smartpoultry-pwa/.env` | `.env.example` | Maps key, Firebase web config |
| `smartpoultry-admin/.env` | `.env.example` | same |

```bash
cp smartpoultry-backend/.env.example smartpoultry-backend/.env
cp smartpoultry-ai/.env.example      smartpoultry-ai/.env
cp smartpoultry-pwa/.env.example     smartpoultry-pwa/.env
cp smartpoultry-admin/.env.example   smartpoultry-admin/.env
```

Two rules that will cost you an afternoon if missed:

- **`AI_SERVICE_API_KEY` must be byte-identical** in `smartpoultry-backend/.env`
  and `smartpoultry-ai/.env`. It is the shared secret between them; if they
  differ, every AI endpoint returns 401 with no other clue.
- **`JWT_SECRET` must be set.** The backend throws on startup without it.

`smartpoultry-backend/firebase-adminsdk.json` is also untracked. Ask Kenneth for
it, or leave it out — see §5.

---

## 2. Route A — Docker (recommended)

```bash
cp .env.docker.example .env
# fill in POSTGRES_PASSWORD, JWT_SECRET, AI_SERVICE_API_KEY
docker compose up --build
```

- PWA → http://localhost:8080
- Admin → http://localhost:8081
- API → http://localhost:5000
- Postgres → localhost:**5433** (not 5432, so it will not fight a Postgres you
  already have installed)

Migrations run automatically on start. To load demo data, run once with
`RUN_SEED=true`, then set it back to false. Full detail in `DOCKER.md`.

Skip to §4.

---

## 3. Route B — manual

### Dependencies

```bash
cd smartpoultry-backend && npm install
cd ../smartpoultry-pwa   && npm install
cd ../smartpoultry-admin && npm install

cd ../smartpoultry-ai
python -m venv .venv
.venv\Scripts\activate         # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
```

### Database

```bash
cd smartpoultry-backend
npx prisma generate            # required - the client is not committed
npx prisma migrate deploy      # applies the 7 committed migrations
npm run db:seed                # needs ADMIN_PASSWORD in your .env
```

`npx prisma generate` is not optional. `schema.prisma` has no `url` in its
datasource block — Prisma 7 reads it from `prisma.config.ts` — and the
generated client lives in `node_modules`, which git does not carry.

### Run the four services

```bash
cd smartpoultry-backend && npm run dev                                  # :5000
cd smartpoultry-ai      && uvicorn app.main:app --reload --port 8000    # :8000
cd smartpoultry-admin   && npm run dev                                  # :5173
cd smartpoultry-pwa     && npm run dev                                  # :5174
```

---

## 4. Train the forecasting models

Charts and the AI advisor stay empty until Prophet has been fitted. With the
stack running and data in the database, signed in as a manager:

```bash
curl -X POST http://localhost:5000/api/ai/retrain -H "Authorization: Bearer <your JWT>"
curl http://localhost:5000/api/ai/diagnostics    -H "Authorization: Bearer <your JWT>"
```

`engine` must read **`prophet`**. If it reads `naive`, Prophet's Stan backend
failed to load and the service is quietly returning a straight-line projection
while still answering HTTP 200 — this is the single most misleading failure in
the system, which is why `engine` is now reported at all.

**Known Windows fix.** Prophet 1.1.6 can ship a stub `cmdstan-2.33.1` folder
inside `prophet/stan_model/` that has `bin/` and `stan/` but no `makefile`,
which is exactly what `cmdstanpy.set_cmdstan_path()` requires. Rename that
folder to `cmdstan-2.33.1.disabled` and retrain; Prophet then uses its own
bundled binary. Reference numbers once fitted: about **7.9% MAPE** on egg yield
and **21.2%** on order demand.

---

## 5. Google Sign-In does not work yet

Known and expected. Firebase is unfinished, so:

- Leave the `VITE_FIREBASE_*` values blank. The button disables itself and says
  "Google Sign-In unavailable" — nothing crashes.
- **Use email and password.** It works fully.

One gotcha that is not a bug: accounts are keyed on `(email, role)`, so the
same email can be a Customer and a Delivery Staff account at once, and they are
separate logins. Signing in on the wrong tab returns "Incorrect email or
password" even when the password is right. The message now says so.

---

## 6. Verify

```bash
cd smartpoultry-backend && npm test        # 23 tests, all should pass
```

Then check by hand:

1. Register a customer → land on the marketplace.
2. Add to cart → **Use my current location** → the address field must populate
   even if the map fails.
3. Place the order → it should be accepted.
4. Print the receipt → it must not be blank.
5. Admin → Analytics → FCR should read roughly 2, not 0.10.
6. Click **Explain** on any chart → a plain-English reading appears.

---

## 7. Things worth knowing

- **`docker-compose.yml` changed.** The backend moved from port 5001 to 5000 to
  match `server.js` and the Vite proxies.
- **`npm test` is new** and uses the Node built-in runner, so no new dependency.
- **Never commit** `.env`, `firebase-adminsdk.json`, `smartpoultry-ai/test_groq.py`
  or anything in `uploads/`. All are gitignored now, but `git add -A` on an old
  checkout could still catch them.
