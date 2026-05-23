# Deploying ORO to AWS Lightsail (eu-west-1, Ireland)

The goal: from a fresh Ubuntu Lightsail instance to ORO serving HTTPS on your domain in well under an hour. Everything needed is in this repo; no managed SaaS is required for boot.

## 0. Pick the instance

- **Region:** `eu-west-1` (Ireland) for GDPR data residency. (Frankfurt also fine — confirm with counsel.)
- **Plan:** start at **2 GB RAM / 1 vCPU** (Postgres + Next build headroom). If you'd rather not build on the box, see §6 — build elsewhere and pull from GHCR.
- **OS:** Ubuntu 24.04 LTS.
- **Static IP:** allocate one in Lightsail and attach it to the instance. Do not skip — without it your DNS A record will detach on instance restart.

## 1. DNS

Create an **A record** for `oro.yourdomain.com` (or whatever you'll use) pointing at the Lightsail static IP. Wait until `dig +short oro.yourdomain.com` resolves to the right address before continuing — Caddy will fail to obtain a certificate otherwise.

## 2. Firewall

Lightsail's *Networking* tab → open ports **80/tcp**, **443/tcp**, and **443/udp** (HTTP/3). Leave SSH on **22/tcp** restricted to your management IP.

## 3. SSH into the box

```bash
ssh ubuntu@<static-ip>
```

## 4. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
   https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# log out and back in for the group to take effect
```

## 5. Get the code + secrets

```bash
git clone <your-repo-url> ~/oro
cd ~/oro
cp .env.example .env
# Generate strong secrets:
AUTH_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY_B64=$(openssl rand -base64 32)
# Edit .env — set ORO_DOMAIN, AUTH_SECRET, ENCRYPTION_KEY_B64, SMTP_*, DATABASE_URL,
# Postgres user/password. The owner-confirmed defaults are fine for most fields.
nano .env
echo "ORO_DOMAIN=oro.yourdomain.com" >> .env
```

> **Don't commit `.env`.** The repo's `.gitignore` already excludes it. Roll secrets through `.env` only.

## 6. (Optional) Pull from GHCR instead of building on-box

If the 2 GB box is tight while running `next build`, build in CI and pull instead:

```bash
echo $GHCR_PAT | docker login ghcr.io -u <user> --password-stdin
export ORO_IMAGE=ghcr.io/<owner>/oro:latest
docker compose pull
```

The compose file honors `ORO_IMAGE`; when set, the `build:` block is unused.

## 7. Boot the stack

```bash
docker compose up -d
# First boot also runs `prisma migrate deploy`; this takes a few seconds.
docker compose logs -f
```

Visit `https://oro.yourdomain.com`. The first request triggers Caddy's TLS handshake with Let's Encrypt — it can take 5-15 seconds while the cert is issued.

## 8. Seed demo data (optional, one-off)

```bash
docker compose exec web node ./dist-worker/worker/seed.js
```

Creates `staff@oro.local`, `partner@oro.local`, three prospects, and one converted client. All accounts use password `oroDemo!1` — change them before sharing.

## 9. Backups

```bash
make backup-db                          # writes ./backups/oro-<timestamp>.sql.gz
make restore-db FILE=backups/oro-...sql.gz
```

For real workloads, schedule via cron:

```cron
0 3 * * *  cd /home/ubuntu/oro && /usr/bin/make backup-db >> ~/oro/backups/backup.log 2>&1
```

…and copy nightly archives off-box (e.g. `aws s3 cp` to an S3 bucket in the same region).

## 10. Updates

```bash
git pull                  # or: docker compose pull   (if using GHCR)
docker compose up -d --build
```

Prisma migrations run automatically on every container start; rolling-restart is safe as long as migrations stay backwards-compatible during the rollout (the schema in this repo only adds, never destroys).

## 11. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Caddy stuck on "obtaining certificate" | DNS not propagated, or port 443 blocked | Check `dig` resolves to the Lightsail IP; verify Lightsail firewall rules |
| `web` exits with EACCES on `/data/docs` | Volume permissions | `docker compose exec -u root web chown -R oro:oro /data/docs` |
| `next build` killed during deploy | Box ran out of RAM | Add 1 GB swap (`fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`) or use GHCR path (§6) |
| Lost `.env` after `docker compose down -v` | `-v` wipes the docs and DB volumes — your `.env` is fine on disk | Don't run `down -v` in prod; use `down` (no flag) for restarts |

## 12. What's *not* yet wired

- WhatsApp reminders — `notify()` no-ops `whatsapp` channel until `TWILIO_*` is set
- Google + LinkedIn OAuth — code paths present, disabled until `*_CLIENT_ID`/`*_SECRET` are set
- S3 / R2 storage — enabled by `STORAGE_DRIVER=s3` + S3_* keys; do this when local volume size becomes a concern
