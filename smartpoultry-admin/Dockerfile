# ─────────────────────────────────────────────────────────────────────────────
#  SmartPoultry admin console — Vite build served by nginx
#
#  Vite substitutes import.meta.env.VITE_* at BUILD time, not run time. They
#  therefore arrive as build args and are baked into the bundle; setting them
#  in `environment:` would do nothing at all.
#
#  Anything passed here ends up readable in the shipped JavaScript. That is
#  fine for a Firebase web config and a referrer-restricted Maps key - both are
#  public client identifiers - but no server-side secret belongs in this file.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Empty default: with the API served from this same origin by the nginx stage
# below, axios' relative "/api/..." paths resolve correctly with no base URL.
ARG VITE_API_BASE_URL=""
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_STORAGE_BUCKET=""
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=""
ARG VITE_FIREBASE_APP_ID=""
ARG VITE_FIREBASE_MEASUREMENT_ID=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID

RUN npm run build

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache curl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=4 \
  CMD curl -fsS http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
