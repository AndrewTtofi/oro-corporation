# ORO — Cyprus Corporate Services onboarding portal

> Self-hosted MVP that runs as a single Docker Compose stack on one AWS Lightsail instance. No managed-SaaS dependency to boot.

## What it is

A custom-built replacement for a failed 70-page no-code attempt at a client-onboarding portal. Prospects submit info and documents *before* they can book a free consultation; staff review, approve, and convert approved prospects to active clients post-call.

## 📖 Documentation

The full reference lives in [**`docs/wiki/`**](./docs/wiki/) — 18 chapters covering architecture, data model, every admin tab, the client portal, the partner workspace, the worker jobs, the API surface, testing, deployment, and troubleshooting. Start with [`docs/wiki/README.md`](./docs/wiki/README.md) or jump directly to:

- [System overview & architecture](./docs/wiki/01-overview.md)
- [Getting started (local dev)](./docs/wiki/02-getting-started.md)
- [Data model](./docs/wiki/04-data-model.md)
- [Admin panel — every tab](./docs/wiki/11-admin-panel.md)
- [Compliance / KYC / AML](./docs/wiki/06-compliance.md)

The same content is also published to the [**GitHub Wiki**](https://github.com/AndrewTtofi/fiduciary-software/wiki) for sidebar-style browsing.

## Architecture

```
                ┌──────────────┐
   internet ──► │  Caddy proxy │  TLS via Let's Encrypt; ports 80/443
                └──────┬───────┘
                       │ reverse_proxy
                ┌──────▼───────┐         ┌──────────────┐
                │  Next.js web │ ◄─────► │  Postgres 16 │
                │  (standalone)│         │  (oro_pgdata)│
                └──────┬───────┘         └──────┬───────┘
                       │ shares /data/docs       │
                ┌──────▼───────┐                 │
                │   Worker     │ ───────────────►│
                │ (node-cron)  │  reminders + key_dates flips
                └──────────────┘
```

Four containers, one host: `proxy`, `web`, `worker`, `db`. Volumes: `oro_pgdata`, `oro_docs`, `caddy_data`, `caddy_config`.

## Quickstart (local)

```bash
cp .env.example .env
# Generate the two secrets the validator demands:
echo "AUTH_SECRET=$(openssl rand -base64 48)" >> .env
echo "ENCRYPTION_KEY_B64=$(openssl rand -base64 32)" >> .env
make dev
```

Open <http://localhost>. Mailpit UI is at <http://localhost:8025> for catching outbound mail. MinIO (S3-compatible dev storage) is at <http://localhost:9001>.

Demo accounts (after `SEED_ON_BOOT=true` runs):

| Role | Email | Password |
|---|---|---|
| Staff | `staff@oro.local` | `oroDemo!1` |
| Partner | `partner@oro.local` | `oroDemo!1` |
| Prospect (pending) | `alex.r@uae-invest.com` | `oroDemo!1` |
| Prospect (needs info) | `david@cohen-tech.io` | `oroDemo!1` |
| Prospect (approved) | `elena.p@limassol.cy` | `oroDemo!1` |
| Client (converted) | `dmitry@meridian.io` | `oroDemo!1` |

## Production deploy

See [`deploy/LIGHTSAIL.md`](./deploy/LIGHTSAIL.md) for the full eu-west-1 runbook.

## Swapping local services for managed ones

Everything external is behind a provider interface in `src/lib/providers/`. Swap by env, no code change:

| Concern | Default | Swap target | How |
|---|---|---|---|
| Storage | Local AES-256-GCM volume | R2 / MinIO / S3 | Set `STORAGE_DRIVER=s3` + `S3_*` keys |
| Email | SMTP (Nodemailer) | Resend | Set `EMAIL_DRIVER=resend` + `RESEND_API_KEY` |
| Calendar | Self-hosted slot generator + `.ics` | Cal.com | Not in MVP — `CalendarProvider` is the seam |
| WhatsApp | No-op | Twilio WhatsApp Business | Set `TWILIO_*` keys |
| OAuth | Off | Google + LinkedIn | Set `GOOGLE_*` / `LINKEDIN_*` keys |

This is the *self-hosted MVP*; the same code path migrates to managed services later by flipping env, not by rewriting.

## Repository layout

```
src/
├─ app/                      Next.js App Router
│  ├─ (marketing)/          marketing pages — warm palette
│  ├─ (auth)/               login/register/verify/forgot
│  ├─ onboarding/           Step 1 → Step 2 → Step 3 → Success
│  ├─ app/                  authenticated client app — warm palette
│  ├─ admin/                staff CRM — cool palette
│  ├─ partner/              read-only mirror — cool palette
│  └─ api/                  Route handlers (health, auth, docs, bookings, cron)
├─ components/               design-system primitives + shell components
├─ lib/
│  ├─ providers/            StorageProvider, EmailProvider, CalendarProvider, NotificationProvider
│  ├─ auth/                 next-auth config + requireRole helper
│  ├─ schema/               Zod schemas (incl. dynamic per-service form)
│  ├─ services/             domain logic — submissions, bookings, clients, docs
│  ├─ crypto/               file envelope helpers
│  └─ db.ts                 prisma client singleton
├─ worker/                  cron worker entry + idempotent seed
prisma/
├─ schema.prisma
├─ seed.ts                  thin wrapper → src/worker/seed.ts
deploy/
├─ Caddyfile
├─ entrypoint.sh            migrate + seed + exec
└─ LIGHTSAIL.md
```

## Security / GDPR posture

- **Authorization is server-side.** `requireRole()` runs on every API route + Server Action; hidden UI is not security.
- **Documents are PII.** AES-256-GCM at rest, served only via authenticated signed app routes, never as a public URL. Doc access is logged to `activity_log`.
- **Passwords:** argon2id (per OWASP). Email verification before onboarding. Password-reset tokens are hashed and TTL-bounded.
- **TLS:** Caddy enforces HTTPS; HSTS preload header set in both Next.js and Caddy.
- **Headers:** `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` locked-down.
- **Rate limits:** auth + upload endpoints (slice 11).
- **Region:** Lightsail `eu-west-1` (Ireland) for data residency.

## License

Proprietary — © ORO Corporate Services Limited.
