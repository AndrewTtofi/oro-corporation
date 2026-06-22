# syntax=docker/dockerfile:1.7
# ────────────────────────────────────────────────────────────────────────
#  ORO — single image for both `web` and `worker` containers.
#  `web` runs Next.js standalone, `worker` runs the cron loop.
#  Switch via the `command:` field in docker-compose.yml.
# ────────────────────────────────────────────────────────────────────────

# 1) deps — install only production dependencies
FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --legacy-peer-deps

# 2) build — compile Next.js (standalone) + worker TS
FROM node:26-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders so Prisma client / env validation don't fail
# during `next build`'s "Collecting page data" phase. Real values come
# from docker-compose env_file at runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build-time-secret-not-used-at-runtime-xxxxxxxx
ENV ENCRYPTION_KEY_B64=YnVpbGQtdGltZS1lbmNyeXB0aW9uLWtleS1ub3QtdXNlZA==
ENV APP_URL=http://localhost
RUN npx prisma generate
RUN npm run build
RUN npm run worker:build

# 3) runner — minimal runtime, non-root
FROM node:26-alpine AS runner
RUN apk add --no-cache openssl tini curl \
 && addgroup -S oro && adduser -S oro -G oro
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

# Standalone output bundles its own minimal node_modules + server.js
COPY --from=builder --chown=oro:oro /app/.next/standalone ./
COPY --from=builder --chown=oro:oro /app/.next/static ./.next/static
COPY --from=builder --chown=oro:oro /app/public ./public

# Prisma artifacts for `prisma migrate deploy` / `db push` at boot + worker
# bundle. Prisma 7 reads the connection URL from prisma.config.ts (the schema no
# longer carries it), so the config file must be present in the runtime image.
# The worker (node-cron, nodemailer, argon2, …) is not traced by next build's
# standalone output, so ship the full production node_modules alongside it.
COPY --from=builder --chown=oro:oro /app/prisma ./prisma
COPY --from=builder --chown=oro:oro /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=oro:oro /app/node_modules ./node_modules
COPY --from=builder --chown=oro:oro /app/dist-worker ./dist-worker

# Entrypoint runs migrations + optional seed, then execs the requested command
COPY --chown=oro:oro deploy/entrypoint.sh /usr/local/bin/oro-entrypoint
RUN chmod +x /usr/local/bin/oro-entrypoint \
 && mkdir -p /data/docs && chown -R oro:oro /data /app

USER oro
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/oro-entrypoint"]
CMD ["node", "server.js"]
