#!/bin/sh
# Backend container start-up.
#
# Runs migrations before the app so a fresh volume comes up with a real schema
# instead of the API crashing on its first query. `migrate deploy` only applies
# committed migrations - it never generates or resets - so it is safe to run on
# every boot, including against a database that is already up to date.
set -e

echo "[entrypoint] waiting for the database..."
# Compose already gates on pg_isready, but that only proves the server accepts
# connections - not that this database and role are usable. A short retry here
# covers the gap and turns a race into a delay rather than a crash loop.
attempt=1
until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  if [ "$attempt" -ge 30 ]; then
    echo "[entrypoint] database unreachable after 30 attempts - giving up." >&2
    exit 1
  fi
  echo "[entrypoint]   attempt $attempt/30 ..."
  attempt=$((attempt + 1))
  sleep 2
done
echo "[entrypoint] database is reachable."

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying migrations..."
  npx prisma migrate deploy
else
  echo "[entrypoint] RUN_MIGRATIONS=false - skipping migrations."
fi

# Opt-in only. Seeding writes demo rows, so it must never be the default on a
# database that already holds real data.
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] seeding demo data..."
  node prisma/seed.js || echo "[entrypoint] seed failed - continuing anyway." >&2
fi

echo "[entrypoint] starting: $*"
exec "$@"
