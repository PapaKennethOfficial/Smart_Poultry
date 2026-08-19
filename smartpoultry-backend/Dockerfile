# ─────────────────────────────────────────────────────────────────────────────
#  SmartPoultry — Node/Express API + Socket.IO + Prisma 7
#
#  Two stages. The builder installs the full dependency tree (including the
#  `prisma` CLI, which is a devDependency) and generates the Prisma client
#  against this exact platform. The runtime keeps the generated client and the
#  production dependency tree.
#
#  The prisma CLI is deliberately kept in the runtime image: schema.prisma has
#  no `url` in its datasource block — Prisma 7 reads it from prisma.config.ts —
#  and `prisma migrate deploy` runs on container start, so both the CLI and
#  that config file have to be present at runtime, not just at build time.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# bcrypt and busboy pull native builds on some platforms; openssl is required
# by Prisma's query engine for TLS to the database.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Manifests first: this layer only busts when dependencies actually change,
# so ordinary source edits reuse the cached install.
COPY package.json package-lock.json ./
RUN npm ci

# Prisma needs the schema and the TS config to generate the client.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# The whole tree comes across rather than a production-only reinstall: the
# generated Prisma client lives inside node_modules/.prisma and node_modules/
# @prisma, and a fresh `npm ci --omit=dev` would drop the CLI we still need
# for migrate deploy.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/src ./src

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# uploads/ holds generated PDF reports and product images. It is a mount point
# for a named volume in compose — created here so the directory exists and is
# writable even when someone runs the image without one.
RUN mkdir -p /app/uploads \
 && useradd --create-home --shell /bin/bash --uid 10001 node_app \
 && chown -R node_app:node_app /app
USER node_app

EXPOSE 5000

# The API answers on / with a JSON banner; that is the cheapest liveness probe
# that proves Express actually booted rather than the port merely being open.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1:${PORT}/ || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
