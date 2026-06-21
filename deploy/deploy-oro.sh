#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
#  deploy-oro.sh — deploy ORO on the ORO host. Run from the repo root
#  (/opt/oro). Idempotent. Pulls the prebuilt image from GHCR (no build).
#
#  No-domain mode: serves HTTP on :80 and self-signed HTTPS on :443, fronted
#  by the cl8 load balancer (HTTP health check on :80 /api/health). When a real
#  domain exists, swap to the domain Caddyfile + Let's Encrypt and set the URLs.
#
#  This is what the deploy.yml GitHub Actions workflow runs over SSH.
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # repo root

IMAGE="${ORO_IMAGE:-ghcr.io/andrewttofi/fiduciary-software:latest}"
PUBIP="${ORO_PUBLIC_IP:-185.106.101.11}"

echo "[deploy] image=$IMAGE pubip=$PUBIP"

# 1) .env — generate ONCE (persist secrets so encrypted docs survive), then
#    only refresh ORO_IMAGE on subsequent deploys.
if [ ! -f .env ]; then
  PGPASS="$(openssl rand -hex 24)"
  cat > .env <<ENV
NODE_ENV=production
ORO_IMAGE=$IMAGE
COMPOSE_PROJECT_NAME=oro
ORO_DOMAIN=$PUBIP
APP_URL=http://$PUBIP
AUTH_URL=http://$PUBIP
AUTH_TRUST_HOST=true
AUTH_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY_B64=$(openssl rand -base64 32)
POSTGRES_USER=oro
POSTGRES_PASSWORD=$PGPASS
POSTGRES_DB=oro
DATABASE_URL=postgresql://oro:$PGPASS@db:5432/oro?schema=public
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/data/docs
EMAIL_DRIVER=console
SMTP_FROM=no-reply@oro.local
SEED_ON_BOOT=false
ENV
  chmod 600 .env
  echo "[deploy] generated new .env"
else
  sed -i "s|^ORO_IMAGE=.*|ORO_IMAGE=$IMAGE|" .env
  echo "[deploy] reused existing .env"
fi

# 2) self-signed cert (once) with the public IP in its SAN
mkdir -p deploy/certs
if [ ! -f deploy/certs/oro.crt ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
    -keyout deploy/certs/oro.key -out deploy/certs/oro.crt \
    -subj "/CN=$PUBIP" -addext "subjectAltName=IP:$PUBIP,DNS:localhost" 2>/dev/null
  chmod 644 deploy/certs/oro.crt && chmod 600 deploy/certs/oro.key
  echo "[deploy] generated self-signed cert"
fi

# 3) compose override (mount the cert) — keeps the repo compose untouched
cat > docker-compose.override.yml <<'OVR'
services:
  proxy:
    volumes:
      - ./deploy/certs:/etc/caddy/certs:ro
OVR

# 4) runtime Caddyfile: HTTP :80 + self-signed HTTPS :443 (no domain)
cat > deploy/Caddyfile <<'CADDY'
{
	auto_https disable_redirects
	servers {
		trusted_proxies static private_ranges
	}
}

(oroapp) {
	encode zstd gzip
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
	request_body {
		max_size 12MB
	}
	reverse_proxy web:3000 {
		health_uri /api/health
		health_interval 30s
		health_timeout 5s
		flush_interval -1
	}
}

:80 {
	import oroapp
}

:443 {
	tls /etc/caddy/certs/oro.crt /etc/caddy/certs/oro.key
	import oroapp
}
CADDY

# 5) pull prebuilt image + start
docker compose pull
docker compose up -d

# 5b) sync DB schema. This repo ships NO prisma migrations (it uses `db push`),
#     so the entrypoint's `migrate deploy` is a no-op and would leave an empty
#     database. `db push` (without --accept-data-loss) applies additive schema
#     changes and refuses destructive ones, so it's safe to run every deploy.
echo "[deploy] syncing DB schema (prisma db push)…"
for i in $(seq 1 20); do
  if docker compose exec -T web node ./node_modules/prisma/build/index.js db push --skip-generate >/dev/null 2>&1; then
    echo "[deploy] schema synced"; break
  fi
  sleep 3
done

# 6) recreating web changes its container IP — bounce the proxy so Caddy
#    re-resolves the upstream (otherwise it 503s on a stale IP).
docker compose restart proxy

# 7) health gate
echo "[deploy] waiting for web health…"
ok=0
for i in $(seq 1 40); do
  if docker compose exec -T web curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
docker compose ps
if [ "$ok" = 1 ]; then
  echo "[deploy] HEALTHY ✅"
else
  echo "[deploy] UNHEALTHY ❌ — recent web logs:"; docker compose logs --tail=60 web; exit 1
fi
