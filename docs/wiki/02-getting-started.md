# 02 — Getting started

## Prerequisites

- Docker Desktop (or any Docker engine + `docker compose`)
- Node 20 (for editor type-checking / running tests on host)
- `gh` CLI (for PR work) — optional but recommended

## First boot

```bash
git clone git@github.com:AndrewTtofi/fiduciary-software.git
cd fiduciary-software
cp .env.example .env
# Generate secrets:
echo "AUTH_SECRET=$(openssl rand -base64 48)" >> .env
echo "ENCRYPTION_KEY_B64=$(openssl rand -base64 32)" >> .env

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Wait until `curl -fsS http://localhost/api/health` returns `{"ok":true}`.
Then visit `http://localhost/login`.

## Demo accounts

All seeded accounts share the password `oroDemo!1`.

| Role | Email | Lands on | Use it for |
|---|---|---|---|
| Staff | `staff@oro.local` | `/admin` | Full admin panel |
| Partner | `partner@oro.local` | `/partner` | Partner-only view |
| Client | `dmitry@meridian.io` | `/app` | Client portal |
| Prospect (pending) | `alex.r@uae-invest.com` | `/onboarding` | Submission in queue |
| Prospect (needs info) | `david@cohen-tech.io` | `/onboarding` | Mid-conversation |
| Prospect (approved) | `elena.p@limassol.cy` | `/onboarding` | Ready to convert |

If the demo data is missing, re-seed:

```bash
docker exec oro-corporation-web-1 npx tsx prisma/seed.ts
```

## Resetting the database

For development:

```bash
curl -X POST 'http://localhost/api/test/reset?seed=1'
docker exec oro-corporation-web-1 npx tsx prisma/seed.ts
```

The first call truncates every domain table; the second re-runs the full
seed (the `?seed=1` flag only seeds the minimal `staff` + `partner` for
tests).

## Side channels

- **Mailpit** at `http://localhost:8025` — captures every outbound email
  (verification links, password resets, document-request notifications,
  partner assignments). Click an email to view its raw content.
- **MinIO console** at `http://localhost:9001` — only relevant if you set
  `STORAGE_DRIVER=s3`. Credentials default to `oro_dev` / `oro_dev_password`.
- **Postgres** is on port 5432 inside the network (not exposed). Use
  `docker exec oro-corporation-db-1 psql -U oro -d oro` for raw SQL.

## Hot reload

The dev compose bind-mounts the repo into `/app` inside the web container.
Webpack and `tsx watch` detect changes on the host and rebuild
automatically. The `node_modules` directory is a *named volume* so the
container's Linux-built native modules (argon2) don't get clobbered by the
host's macOS-built ones.

If hot reload looks stuck:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart web
```

## Running tests on the host

```bash
npm install --legacy-peer-deps      # only first time
npm run typecheck                   # tsc --noEmit
npm run lint                        # next lint
npm run test:unit                   # vitest, unit project
npm run test:integration            # vitest, integration project (testcontainers — needs Docker)
npm run test:e2e                    # playwright; requires dev stack running
```

The integration tests spin up an ephemeral Postgres via `@testcontainers/postgresql`,
apply the Prisma schema, and roll back every test with `inRollbackTx`. They do
not touch your dev database.

## Common dev-only env vars

| Var | Default | Purpose |
|---|---|---|
| `SEED_ON_BOOT` | `true` (dev) | Run `prisma/seed.ts` when the web container boots |
| `ALLOW_TEST_RESET` | `1` (dev) | Enables `POST /api/test/reset` |
| `STORAGE_DRIVER` | `local` | Set to `s3` to test the S3 envelope flow |
| `OPENSANCTIONS_API_KEY` | unset | If set, screenings hit the live API instead of the deterministic mock |

See `.env.example` for the full list.

## Troubleshooting first boot

| Symptom | Likely cause | Fix |
|---|---|---|
| `Invalid environment variables` on boot | Missing `AUTH_SECRET` / `ENCRYPTION_KEY_B64` | Re-run the secret-generation lines above |
| Web container restarts forever | `prisma db push` failed because db isn't ready | `docker compose logs db` — check Postgres health |
| Login 500s | Demo data not seeded | Run the `npx tsx prisma/seed.ts` command above |
| Hot reload doesn't fire | macOS bind-mount watcher choked | Restart the web container |
| `Unknown system error -35` | Stray duplicate files (e.g. `* 2.ts`) confusing webpack | `find . -name "* 2.*" -delete` |
