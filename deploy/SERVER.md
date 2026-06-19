# Deploying ORO to a rented Ubuntu 26.04 server

This is the runbook for a **bare datacenter / VPS box** (dedicated or virtual) — as
opposed to AWS Lightsail, which has its own cloud firewall and console (see
[`LIGHTSAIL.md`](./LIGHTSAIL.md)). On a rented box *you* are the firewall and
*you* own the static IP, so there are a few extra steps. Everything else — the
4-container stack, the persistent volumes, auto-TLS, migrations-on-boot — is
identical and already in the repo.

Goal: fresh box → ORO serving HTTPS on your domain in under an hour.

---

## 0. Server spec

| Tier | vCPU | RAM | Disk | When |
|---|---|---|---|---|
| Minimum | 1 | 2 GB | 40 GB SSD | Only with a swap file (§5) **or** if you pull a pre-built image instead of building on-box |
| **Recommended** | **2** | **4 GB** | **60–80 GB SSD/NVMe** | Comfortable on-box `next build` + Postgres cache + document growth |
| Comfortable | 4 | 8 GB | 100+ GB SSD | Heavier concurrent staff/client load |

- **Insist on SSD/NVMe** — Postgres performance collapses on spinning disks.
- The only RAM-hungry moment is `next build` (~1.5–2 GB spike) when you build the
  image on the box. Runtime footprint is far smaller (caps in
  `docker-compose.prod.yml`: web 1.5 G, db 1 G, worker 512 M, proxy 256 M).
- Disk growth is dominated by uploaded documents (`oro_docs`, 10 MB max each).
  When it gets tight, flip `STORAGE_DRIVER=s3` — no code change.

## 1. First-login hardening (do this before anything else)

```bash
ssh root@<your-server-ip>        # or the user your provider gave you

# Create a non-root sudo user (skip if your provider already made one):
adduser ubuntu
usermod -aG sudo ubuntu
rsync --archive --chown=ubuntu:ubuntu ~/.ssh /home/ubuntu   # copy your SSH key

apt-get update && apt-get -y upgrade
```

Then in `/etc/ssh/sshd_config` set `PermitRootLogin no` and
`PasswordAuthentication no`, and `systemctl restart ssh`. Reconnect as `ubuntu`.

## 2. Host firewall (UFW) — the Lightsail-firewall replacement

A rented box has **no cloud firewall in front of it**. Set up UFW:

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH                  # 22/tcp — or restrict to your IP (see below)
sudo ufw allow 80/tcp                   # HTTP (Caddy ACME challenge + redirect)
sudo ufw allow 443/tcp                  # HTTPS
sudo ufw allow 443/udp                  # HTTP/3 (QUIC)
sudo ufw enable
sudo ufw status verbose
```

Tighter SSH (recommended): `sudo ufw allow from <your-office-ip> to any port 22`
instead of the broad `allow OpenSSH`.

> Note: Docker normally bypasses UFW by writing its own iptables rules. That's
> fine here because the only published ports are 80/443 on the `proxy` container
> (which you *want* open). `web`, `worker`, and `db` publish **nothing** to the
> host — they're reachable only on the internal Docker networks. Never add a
> `ports:` mapping for `db` in production.

## 3. DNS

Create an **A record** for `oro.yourdomain.com` pointing at the server's public
IP. (Add an `AAAA` record too if the box has a stable IPv6.) Wait for it:

```bash
dig +short oro.yourdomain.com      # must return your server IP before §7
```

Caddy cannot obtain a TLS certificate until this resolves.

## 4. Install Docker Engine + Compose v2

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Use this box's codename automatically:
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
   https://download.docker.com/linux/ubuntu $CODENAME stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

> **26.04 gotcha:** Docker's apt repo may not yet publish a directory for
> 26.04's codename, so `apt-get update` 404s on the docker line. Two fixes:
> 1. **Pin the previous LTS codename** — replace `$CODENAME` above with `noble`
>    (24.04). The packages are forward-compatible. Re-run the `tee` + update.
> 2. **Use Docker's convenience script:** `curl -fsSL https://get.docker.com | sudo sh`
>    then `sudo usermod -aG docker $USER`.

Log out and back in (or `newgrp docker`) so the group applies, then verify:
`docker run --rm hello-world`.

## 5. (Only on a 2 GB box) Add swap

Protects the `next build` step from the OOM killer:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

On a 4 GB+ box this is optional. Alternatively, build the image in CI and pull
it (§9) so the box never runs `next build`.

## 6. Code + secrets

```bash
git clone <your-repo-url> ~/oro
cd ~/oro
cp .env.example .env

# Generate the two secrets the boot validator demands:
echo "AUTH_SECRET=$(openssl rand -base64 48)"        >> .env
echo "ENCRYPTION_KEY_B64=$(openssl rand -base64 32)" >> .env
echo "ORO_DOMAIN=oro.yourdomain.com"                 >> .env
nano .env
```

In `.env`, set/confirm:

| Key | Set to |
|---|---|
| `ORO_DOMAIN` | your real hostname — Caddy uses it for the cert |
| `APP_URL`, `AUTH_URL` | `https://oro.yourdomain.com` |
| `POSTGRES_PASSWORD` | a strong random password (not the `oro` default) |
| `DATABASE_URL` | `postgresql://oro:<that-password>@db:5432/oro?schema=public` |
| `SMTP_*` | your transactional mail host (or set `EMAIL_DRIVER=resend` + `RESEND_API_KEY`) |
| `SEED_ON_BOOT` | `false` (only `true` if you want demo accounts) |

> 🔑 **Back up `ENCRYPTION_KEY_B64` and `AUTH_SECRET` somewhere off the box right
> now** (password manager). Lose `ENCRYPTION_KEY_B64` and every uploaded document
> becomes unrecoverable ciphertext — a database restore alone won't save you.
> `.env` is gitignored; it never leaves this box except via your backups.

## 7. Boot the stack

```bash
make up        # = docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
make logs      # watch boot; first boot runs `prisma migrate deploy`
```

The Makefile layers the **production hardening overlay** (`docker-compose.prod.yml`:
memory/CPU caps, log rotation, `no-new-privileges`, pids limits) on top of the
base compose. To run it by hand:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Visit `https://oro.yourdomain.com`. The first request triggers Caddy's
Let's Encrypt handshake (5–15 s while the cert issues). Check health any time:
`curl -fsS https://oro.yourdomain.com/api/health`.

## 8. Persistent data — what survives, what to back up

Four named volumes hold all durable state (defined in `docker-compose.yml`):

| Volume | Container path | Contents | Back up? |
|---|---|---|---|
| `oro_pgdata` | `db:/var/lib/postgresql/data` | the entire database | 🔴 yes |
| `oro_docs` | `web:/data/docs` | AES-256-GCM-encrypted client documents (PII) | 🔴 yes |
| `caddy_data` | `proxy:/data` | TLS certs + ACME account | 🟡 yes (avoids re-issue rate limits) |
| `caddy_config` | `proxy:/config` | Caddy autosave | 🟢 regenerable |

`docker compose down` (no flag) keeps all volumes — only `down -v` destroys them.
**Never run `down -v` in production.**

Automated backups are wired up — see §11.

## 9. (Optional) Build in CI, pull on-box

To keep the box from ever running `next build`, build/push to GHCR in CI and pull:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u <user> --password-stdin
export ORO_IMAGE=ghcr.io/<owner>/oro:latest      # add to .env to persist
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
make up
```

When `ORO_IMAGE` is set, the compose `build:` block is ignored.

## 10. Updates

```bash
cd ~/oro
git pull                 # or: docker compose pull   (GHCR path)
make up                  # rebuilds + rolling-restarts; migrations run on boot
```

Migrations are additive-only in this repo, so rolling restart is safe.

## 11. Automated backups (db + docs + secrets)

The repo ships `deploy/backup.sh`, which streams a `pg_dump`, a tar of the
encrypted `oro_docs`, **and** the `.env` secrets into a timestamped folder,
checksums them, optionally copies off-box, and prunes old runs.

Install the nightly systemd timer (preferred on 26.04):

```bash
# Edit User= / WorkingDirectory= / paths in the unit to match your box first:
sudo cp deploy/oro-backup.service deploy/oro-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oro-backup.timer
systemctl list-timers oro-backup.timer        # confirm next run
sudo systemctl start oro-backup.service       # run one now as a test
journalctl -u oro-backup.service -e           # check it
```

**Off-box copies are not optional for real data.** A local-only backup dies with
the disk. Set, in `oro-backup.service`:

```ini
Environment=RCLONE_REMOTE=s3:oro-backups        # any rclone remote (S3/R2/B2/…)
Environment=ENV_BACKUP_PASSPHRASE=<long-random> # encrypts the .env in the archive
```

(Install + configure rclone first: `sudo apt-get install -y rclone && rclone config`.)

Manual backup / restore at any time:

```bash
make backup-all                                  # full backup now
make restore-all DIR=backups/<timestamp>         # restore db + docs from a folder
```

`cron` alternative, if you prefer it over systemd:

```cron
0 3 * * *  cd /home/ubuntu/oro && ./deploy/backup.sh >> /home/ubuntu/oro/backups/backup.log 2>&1
```

## 11b. Continuous deployment from GitHub Actions

CI already builds and pushes the image to GHCR (`build-image` job). The
`.github/workflows/deploy.yml` workflow then **pulls that image onto this box
over SSH** — so the server never runs `next build`. It fires automatically after
CI passes on `main`, and can be run manually (Actions → Deploy → Run workflow)
to deploy a specific tag or roll back.

**One-time server prep:**

1. Make sure the repo is cloned at `~/oro` and `.env` is in place (§6), and the
   deploy user (`ubuntu`) is in the `docker` group.
2. Create an SSH key *for CI* and authorize it on the box:
   ```bash
   # on your laptop:
   ssh-keygen -t ed25519 -f oro_deploy -C "github-actions"
   ssh-copy-id -i oro_deploy.pub ubuntu@<server-ip>   # or append .pub to ~/.ssh/authorized_keys
   ```
3. In GitHub → **Settings → Secrets and variables → Actions**, add:

   | Secret | Value |
   |---|---|
   | `DEPLOY_HOST` | server IP / hostname |
   | `DEPLOY_USER` | `ubuntu` |
   | `DEPLOY_SSH_KEY` | contents of the **private** `oro_deploy` file |
   | `DEPLOY_SSH_PORT` | (optional) ssh port if not 22 |
   | `GHCR_USERNAME` | your GitHub username |
   | `GHCR_READ_PAT` | a PAT with **`read:packages`** (so the box can pull the private image) |

4. (Recommended) Settings → **Environments → production** → add yourself as a
   required reviewer, so each deploy needs a one-click approval.

After that, every merge to `main` that passes CI auto-deploys. The workflow pins
`ORO_IMAGE` in the server's `.env`, pulls, restarts with the hardening overlay,
and fails the run if `/api/health` doesn't come up.

> **Manual ops still build, CD pulls.** `make up` uses `--build`; the deploy
> workflow uses `docker compose pull` + `up -d` (no build). Once `ORO_IMAGE` is
> pinned in `.env`, prefer `docker compose -f docker-compose.yml -f
> docker-compose.prod.yml pull && … up -d` for manual restarts too, so you don't
> accidentally rebuild on the box.

## 12. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `apt-get update` 404s on the docker repo | 26.04 codename not yet in Docker's repo | Pin `noble` or use the convenience script (§4) |
| Caddy stuck "obtaining certificate" | DNS not propagated, or 80/443 blocked | `dig` must resolve to this box; check `ufw status` |
| `web` exits `EACCES` on `/data/docs` | volume ownership | `docker compose exec -u root web chown -R oro:oro /data/docs` |
| `next build` killed mid-deploy | box out of RAM | add swap (§5) or pull from GHCR (§9) |
| Site unreachable but containers "up" | UFW didn't open 443/udp | `sudo ufw allow 443/udp` |
| Lost data after `down -v` | `-v` wiped the volumes | never use `-v` in prod; restore from backup (§11) |

## 13. Not yet wired (env-gated, off until configured)

- WhatsApp reminders — `notify()` no-ops the `whatsapp` channel until `TWILIO_*` is set
- Google + LinkedIn OAuth — disabled until `*_CLIENT_ID` / `*_SECRET` are set
- S3 / R2 storage — enabled by `STORAGE_DRIVER=s3` + `S3_*` keys
