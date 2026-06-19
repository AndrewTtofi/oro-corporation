#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────
#  ORO — full persistent-data backup.
#
#  Captures the THREE things you need to fully restore ORO:
#    1. db.sql.gz    — pg_dump of the entire database (oro_pgdata volume)
#    2. docs.tar.gz  — the AES-256-GCM-encrypted document store (oro_docs volume)
#    3. env.enc      — the .env secrets, WITHOUT which docs.tar.gz is unrecoverable
#                      ciphertext. (ENCRYPTION_KEY_B64 lives here.)
#
#  Each run writes a timestamped folder under $BACKUP_DIR, prunes folders
#  older than $RETENTION_DAYS, and — if $RCLONE_REMOTE is set — copies the
#  new folder off-box. Streams data straight out of the RUNNING containers,
#  so it never has to guess Docker volume names.
#
#  Usage:
#      ./deploy/backup.sh
#
#  Tunables (env or .env):
#      BACKUP_DIR=./backups        where archives land on this host
#      RETENTION_DAYS=14           prune local folders older than this
#      RCLONE_REMOTE=              e.g. "s3:oro-backups/eu-west-1" (off-box copy)
#      ENV_BACKUP_PASSPHRASE=      if set, env.enc is AES-encrypted with it;
#                                  otherwise the raw .env is copied (0600).
# ───────────────────────────────────────────────────────────────────────
set -euo pipefail

# Resolve repo root (this script lives in deploy/) and run compose from there.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Load .env so POSTGRES_* and the tunables are available.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-oro}"
POSTGRES_DB="${POSTGRES_DB:-oro}"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
# 'date -u' is fine here — this runs on the host, not inside a workflow sandbox.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/$STAMP"
mkdir -p "$DEST"

log() { echo "[oro-backup] $*"; }

log "writing backup to $DEST"

# 1) Database ------------------------------------------------------------
log "dumping database '$POSTGRES_DB'…"
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "$DEST/db.sql.gz"

# 2) Encrypted document store -------------------------------------------
# web mounts oro_docs at /data/docs. Stream a tar of it straight out.
log "archiving encrypted documents…"
$COMPOSE exec -T web tar -czf - -C /data docs > "$DEST/docs.tar.gz"

# 3) Secrets (.env) ------------------------------------------------------
# Without ENCRYPTION_KEY_B64 the docs archive is useless ciphertext, so the
# secrets MUST be part of the backup — but guard them.
if [ -f .env ]; then
  if [ -n "${ENV_BACKUP_PASSPHRASE:-}" ]; then
    log "encrypting .env → env.enc (AES-256)…"
    openssl enc -aes-256-cbc -pbkdf2 -salt \
      -pass "pass:$ENV_BACKUP_PASSPHRASE" \
      -in .env -out "$DEST/env.enc"
  else
    log "copying .env (set ENV_BACKUP_PASSPHRASE to encrypt it at rest)…"
    cp .env "$DEST/env.bak"
  fi
fi
chmod -R go-rwx "$DEST"

# Checksums + a tiny manifest for restore-time verification.
( cd "$DEST" && sha256sum -- * > SHA256SUMS )
log "wrote: $(cd "$DEST" && du -sh . | cut -f1) — $(ls "$DEST" | tr '\n' ' ')"

# 4) Off-box copy (optional but strongly recommended) -------------------
if [ -n "${RCLONE_REMOTE:-}" ]; then
  log "copying off-box to $RCLONE_REMOTE/$STAMP …"
  rclone copy "$DEST" "$RCLONE_REMOTE/$STAMP"
else
  log "RCLONE_REMOTE unset — backup is LOCAL ONLY. A disk failure loses it."
fi

# 5) Prune old local folders --------------------------------------------
log "pruning local backups older than ${RETENTION_DAYS} days…"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" \
  -exec rm -rf {} + 2>/dev/null || true

log "done."
