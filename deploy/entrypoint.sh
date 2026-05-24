#!/bin/sh
# ORO entrypoint: applies pending migrations, optionally seeds, then execs CMD.
# Idempotent — safe to run on every container start.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[oro-entrypoint] applying prisma migrations…"
  node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

  if [ "$SEED_ON_BOOT" = "true" ]; then
    echo "[oro-entrypoint] running idempotent seed (SEED_ON_BOOT=true)…"
    node ./dist-worker/worker/seed.js || echo "[oro-entrypoint] seed failed (continuing)"
  fi
else
  echo "[oro-entrypoint] DATABASE_URL not set; skipping migrations"
fi

echo "[oro-entrypoint] starting: $*"
exec "$@"
