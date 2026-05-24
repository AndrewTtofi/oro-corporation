# Claude Code Build Prompt — ORO Onboarding Platform (Dockerized, Lightsail-ready MVP)

> Paste everything below this line into Claude Code as your initial instruction. It assumes `ORO_MVP.pdf` (the dev spec) and the `ORO.zip` design export (12 HTML screens + `DESIGN-HANDOFF.md` + `DESIGN-MANIFEST.json`) are present in the working directory or have been added to context. Read both before writing any code.

---a

## 0. Your role and the prime directive

You are building the **MVP of ORO**, a client-onboarding portal for a Cyprus corporate-services firm. The single most important constraint, and the thing that overrides the spec's "Suggested Stack" section, is this:

**The entire application must run as a self-contained Docker Compose stack on ONE AWS Lightsail instance, with no dependency on any managed SaaS to function.** The spec was written assuming Supabase + Vercel + Cal.com + Resend. We are deliberately doing the self-hosted equivalent instead, because we are deploying to a single Lightsail box "for starters." Translate every managed-service assumption in the spec into a self-hostable component (see §3). Keep external dependencies behind interfaces so a future swap to a managed provider is a config change, not a rewrite.

Before writing code: read `ORO_MVP.pdf` end to end, read `DESIGN-HANDOFF.md` and `DESIGN-MANIFEST.json`, and open all 12 HTML screens. The HTML export is the **visual contract** — match its tokens, layout, and component states. The PDF is the **functional contract** — match its data model, flows, and roles.

Do not start coding until you have produced the plan in §9 and I have approved it.

---

## 1. What ORO is (functional summary from the spec)

A portal where **prospects** submit their info and documents *before* they can book a free consultation. This replaces a broken flow where anyone booked a calendar slot and half ghosted. A previous no-code attempt (70+ pages) failed; this is a focused, custom-built MVP.

Core flow:
```
Landing → Register → Select Services → Fill Dynamic Form → Upload Docs → Submit
   → Staff reviews & approves → Client books consultation → Post-call: convert to active client
```

### User roles (enforce with real authorization, not just hidden UI)
| Role | Access |
|---|---|
| **Prospect** | Public pages, registration, onboarding form, document upload. **Cannot book until approved.** |
| **Client** | Everything a prospect has + booking, dashboard, messages. Created by converting an approved prospect post-consultation. |
| **Staff (Admin)** | Submissions queue, review/approve/reject, client management, analytics, content editing, full access. |
| **Partner (Lawyer/Accountant)** | **Read-only** on assigned clients (profile, documents, notes). Cannot approve/reject. Can add notes and view staff notes. |

---

## 2. Screens to build (each its own route — screen-file-first)

Implement each of the 12 exported HTML screens as its own route/page. Do **not** merge them. `landing.html` stays a separate marketing surface from the product app.

**Public / auth**
- `landing.html` → `/` — marketing landing. Title: "ORO Corporate Services · Your Gateway to Business in Cyprus". Match `orocorporateservices.com` content/structure intent; SEO matters; keep it content-driven.
- `services.html` → `/services` — service overview (public marketing).
- `auth.html` → `/login`, `/register` — register (name, email, phone w/ country code, password) + login (email+password, forgot-password flow). Email verification required before proceeding. Google + LinkedIn OAuth as an option (gate behind env flags — see §3).

**Onboarding (auth required — THIS IS THE CORE)**
- `onboarding-form.html` → `/onboarding` — the multi-step heart of the app:
  - **Step 1 — Service Selection:** 6 multi-select cards (min 1 required): Company Formation, Accounting & VAT, Tax Residency (Non-Dom), Immigration, Licensing, Banking Solutions. Selection drives Step 2 fields.
  - **Step 2 — Dynamic Qualification Form.**
    - Always shown: Full legal name (as on passport), Date of birth, Nationality (country dropdown), Country of residence (country dropdown), Current address, Business description/intent (textarea, min 100 chars), Expected annual turnover (Under 50K / 50K–200K / 200K–500K / 500K–1M / 1M+ EUR), Timeline (Immediately / Within 1 month / 1–3 months / Just exploring), Source (Google / Referral / Social Media / Event / Other).
    - **Conditional fields by selected service:**
      | Service | Extra fields |
      |---|---|
      | Company Formation | Proposed company name, business activity type, number of shareholders, nominee services needed (bool) |
      | Tax Residency | Current tax residency country, 60+ days in Cyprus (bool), employment status |
      | Immigration | Permit type (work/PR/digital nomad), family members count |
      | Accounting | Existing Cyprus company (bool), reg number if yes, accounting software, monthly transaction volume |
      | Banking | Account purpose, expected monthly volume, main counterpart countries |
      | Licensing | License type (CySEC/CBC/etc), current jurisdiction, existing licenses |
    - **Save-draft functionality — do not lose form state.** Persist drafts server-side keyed to the user.
  - **Step 3 — Document Upload:** Passport/National ID (required, PDF/JPG/PNG, max 10MB), Proof of address (required, utility bill or bank statement <3 months old), Additional docs (optional). Drag & drop, progress indicator, preview, remove/re-upload. **Encrypted at rest, EU storage, GDPR compliant.**
- `success.html` → `/onboarding/success` — confirmation screen with reference number, format **`ORO-2026-XXXXX`**, estimated review time 24–48h.

**Client app (post-submission)** — sidebar nav: Dashboard, My Application, Messages, Documents, Book Consultation (locked until approved), Settings.
- `client-dashboard.html` → `/app/dashboard` — welcome banner, application status card with timeline (Submitted → Under Review → Approved → Consultation Booked), upcoming consultation, recent messages.
- `documents.html` → `/app/documents` — uploaded docs with per-doc status (received / under review / approved / re-upload needed); upload additional.
- (Messages) → `/app/messages` — thread with ORO team, file attachments, email + in-app notifications on new messages. *(No dedicated export file; build from the design system + dashboard's "recent messages" component.)*
- `booking.html` → `/app/booking` — **unlocked on approval.** Calendar showing available slots for next 2 weeks, timezone auto-detect, expert selection (name, specialization), confirmation with calendar invite (.ics). Automated reminders at 24h and 1h before (email + WhatsApp).
- (Settings) → `/app/settings` — edit profile, password, notification prefs, language (EN/RU). *(Build from design system.)*

**Admin app** — sidebar nav with admin sections.
- `admin-dashboard.html` → `/admin` — overview + analytics entry.
- `admin-detail.html` → `/admin/submissions/:ref` — **Submission Detail.** Left: full profile data + document viewer (inline preview + download). Right: status controls, assign-to-partner dropdown, internal notes (timestamped, attributed), activity log. Actions: Approve / Request More Info (predefined checklist + custom message) / Reject.
- (Submissions queue) → `/admin/submissions` — table (Reference #, Name, Services, Country, Date, Status, Actions); filters (status, service type, date range, country); search by name/email; status options: Pending Review / Approved / Needs More Info / Rejected. *(Queue view; derive from admin-detail design system + spec.)*
- `admin-clients.html` → `/admin/clients` — Client list (name, company, services engaged, assigned partner, next key date, status: Active/On Hold/Completed). **Convert approved prospect → active client (one-click, post-consultation.)**
- `admin-client-profile.html` → `/admin/clients/:id` — **the design entry file; treat as the canonical token/component source.** Client profile: services-engaged cards (name, status In Progress/Completed/Pending, start date, assigned partner); key dates & reminders (annual returns, VAT filings, license renewals, permit expiries; status upcoming/overdue/completed; manually addable); documents in folders by service type; consultation history with notes; internal notes thread; activity log; assigned-team management; quick actions (Send Message, Request Docs, Add Service, Add Key Date).
- (Bookings view) → `/admin/bookings` — calendar of upcoming consultations, link to prospect/client profile from each booking.
- (Analytics) → `/admin/analytics` — submissions count, by service, approval rate, avg time to consultation, no-show rate, top countries.

**Partner portal** → `/partner` — assigned clients list (read-only), client profile + documents, internal notes (can add, can view staff notes), **cannot approve/reject/change status.** Reuse client-profile components in a read-only mode.

---

## 3. Stack — self-hosted translation of the spec (USE THIS, not the spec's "Suggested Stack")

The spec suggests managed services. For a single Lightsail box, build the self-hostable equivalent and put every external integration behind an interface/adapter so it can be swapped later.

| Concern | Spec suggested | **Build this instead (Lightsail/self-hosted)** |
|---|---|---|
| Framework | Next.js + Tailwind | **Next.js (App Router) + TypeScript + Tailwind CSS.** Single app, API via Route Handlers / Server Actions. |
| DB | PostgreSQL via Supabase/Neon | **PostgreSQL 16 in a Docker container** (named volume for data). |
| Auth | Supabase Auth / NextAuth | **Auth.js (NextAuth v5)** with Credentials provider (email+password, bcrypt/argon2) as the always-on default. Google + LinkedIn OAuth providers wired but **enabled only when their env vars are set.** Email verification + forgot-password via the email adapter below. Sessions = JWT or DB sessions (Prisma adapter). |
| ORM | — | **Prisma** (clean migrations, typed client, matches the §4 schema). |
| File storage | Supabase Storage / Cloudflare R2 (encrypted, EU) | **Local encrypted volume** behind a `StorageProvider` interface. Default impl: write to a Docker volume on the (EU-region) Lightsail box, encrypt at rest (per-file AES-256-GCM with a key from env/secret; or rely on an encrypted EBS-equivalent + app-level encryption for sensitive docs). Provide an `S3StorageProvider` stub (S3-compatible, works with R2/MinIO) selectable by env so migration is config-only. Serve files only through authorized, signed, time-limited app routes — never publicly. |
| Email | Resend / SendGrid | **`EmailProvider` interface.** Default impl = SMTP via Nodemailer (works with any SMTP, incl. Amazon SES SMTP, which fits AWS). Provide a Resend adapter behind the same interface. Used for: verification, password reset, submission confirmations, status-change notifications, booking confirmations, reminders. |
| Calendar/booking | Cal.com API | **Self-hosted booking module** (own `bookings` + availability tables, slot generation for next 2 weeks, timezone handling via the browser TZ + server normalization to UTC). Generate **.ics** invites ourselves (ical-generator). Keep a `CalendarProvider` interface so Cal.com can be slotted in later. |
| WhatsApp reminders (P1) | Twilio / WhatsApp Business | **`NotificationProvider` interface**, WhatsApp impl behind env flag (Twilio). Ship email reminders working in MVP; WhatsApp is P1 and can be a no-op adapter until configured. |
| Reminders scheduler | (implicit) | **In-container scheduler** — a small worker (node-cron in a dedicated container, OR a `/api/cron/*` route triggered by the host's cron / a `cron` sidecar) that fires 24h and 1h booking reminders and sets `reminder_sent_24h` / `reminder_sent_1h`. Idempotent. |
| Analytics (P1) | PostHog | Compute the spec's metrics from our own DB for the admin analytics page (no external dep needed for MVP). Leave a hook for PostHog later. |
| Reverse proxy / TLS | (Vercel handled it) | **Caddy** (auto-HTTPS via Let's Encrypt) or **Nginx + Certbot** as the edge container, terminating TLS and proxying to the Next.js container. Caddy preferred for zero-config certs. |

**Everything above ships as services in one `docker-compose.yml`:** `web` (Next.js), `db` (Postgres), `proxy` (Caddy), and `worker`/`cron` (reminders). Optionally `minio` for local S3-compatible storage in dev. No service may require a paid SaaS to boot.

---

## 4. Data model (Prisma schema — implement exactly these entities)

From the spec. Use UUID PKs, `created_at` defaults, proper FKs, and Postgres enums for status fields. Add indexes on lookup columns (reference_number, email, status, foreign keys).

- **users** — id, email (unique), password_hash, full_name, phone, role (`prospect | client | staff | partner`), email_verified, created_at, language_pref (`en | ru`).
- **prospects** — id, user_id (FK), reference_number (unique, `ORO-2026-XXXXX`), status (`pending | approved | needs_info | rejected`), services_selected (string[] / json), created_at, reviewed_at, reviewed_by (FK users).
- **prospect_details** — id, prospect_id (FK), field_name, field_value. *(Flexible key-value store for the dynamic per-service form fields. Plus persist Step 2 drafts here or in a `draft` json column on prospects — your call, but drafts must survive logout.)*
- **documents** — id, prospect_id (FK), type (`passport | proof_of_address | other`), file_url (internal pointer, not public URL), status (`received | under_review | approved | reupload_needed`), uploaded_at. *(Store encryption metadata + original filename + mime + size.)*
- **clients** — id, user_id (FK), prospect_id (origin FK), company_name, status (`active | on_hold | completed`), primary_staff_id (FK users), created_at.
- **client_services** — id, client_id (FK), service_type, status (`pending | in_progress | completed`), assigned_partner_id (FK users), start_date, notes.
- **key_dates** — id, client_id (FK), description, due_date, status (`upcoming | overdue | completed`). *(Manually addable; a job flips upcoming→overdue when past due.)*
- **messages** — id, prospect_id?/client_id? (one of), sender_id (FK users), body, attachments (json), created_at.
- **internal_notes** — id, prospect_id?/client_id? (one of), author_id (FK users), body, created_at. *(Timestamped + attributed; partners can add + read staff notes.)*
- **bookings** — id, prospect_id (FK), expert_id (FK users), datetime, timezone, status (`confirmed | completed | no_show | cancelled`), reminder_sent_24h (bool), reminder_sent_1h (bool).
- **activity_log** — id, entity_type, entity_id, action, actor_id (FK users), created_at. *(Write to this on every meaningful state change: status changes, conversions, doc uploads, note adds, bookings.)*

Seed script: 1 staff user, 1 partner, a couple of prospects in different statuses, and one converted client with services/key_dates — so every screen has realistic data on first run.

---

## 5. Design fidelity contract (from DESIGN-HANDOFF.md — non-negotiable)

Extract and **freeze these tokens** (sampled from the entry file `admin-client-profile.html`) into the Tailwind theme / CSS variables before building components. Do not let the framework substitute defaults.

```
--bg:      #F9FAFB    --surface: #FFFFFF    --fg:      #111827
--muted:   #6B7280    --border:  #E5E7EB    --accent:  #C8A45A   (gold)
--dark:    #0A0A0A
--font-body:    'Plus Jakarta Sans', system-ui, sans-serif
--font-display: 'Playfair Display', serif
--font-mono:    'IBM Plex Mono', monospace
radius: cards 12px, inner elements 6–8px
admin layout: 240px dark sidebar + main; top-bar 64px; content padding 32px
```

Rules:
- Match typography scale, spacing rhythm, color tokens, radii, shadows, motion timing, and **all component states** (default, hover, focus, active, disabled, loading, empty, error, success).
- Preserve **real copy and labels** from the export — no generic marketing filler.
- Preserve accessibility semantics: hierarchical headings, real `<button>`/`<a>`/`<input>` controls, visible focus states.
- Do **not** introduce beige/cream/peach/pink/orange-brown washes. The palette is the gold accent on light-gray/white with a near-black dark surface for chrome.
- Responsive: one adaptive web experience using fluid `clamp()` type/spacing and container queries where component width matters. Validate **no horizontal overflow** at: 360×800, 390×844, 430×932, 600×960, 820×1180, 1024×768, 1366×768, 1440×900, 1920×1080.
- Strip all design-export chrome / preview labels / annotations from production UI.

---

## 6. Security, GDPR, and authorization (the parts that matter for a corporate-services firm)

- **Authorization is server-side and role-based** on every API route and server action. Hidden UI is not security. A partner hitting an approve endpoint must be rejected at the server.
- Partners are **strictly read-only** on assigned clients except for adding internal notes. They cannot change status or approve/reject — enforce in the handler.
- Documents are sensitive PII. **Encrypt at rest**, store on an EU-region disk, serve only via authenticated, authorized, time-limited signed routes. Never expose a public file URL. Log access to `activity_log`.
- Passwords hashed with argon2id (or bcrypt cost ≥12). Email verification before onboarding proceeds. Secure password-reset tokens (hashed, expiring).
- Rate-limit auth + upload endpoints. CSRF protection on mutations. Set secure headers (helmet-equivalent / Next config). HTTPS only (Caddy enforces).
- Validate all input with **Zod** on the server (mirror the dynamic form's conditional requirements). 10MB upload cap, MIME allowlist (PDF/JPG/PNG) enforced server-side, not just client.
- Keep secrets in env / Docker secrets, never in the image. Provide `.env.example` with every key documented; never commit real `.env`.

---

## 7. Dockerization & Lightsail deployment (the deliverable)

Produce a stack that comes up with `docker compose up -d` on a fresh Lightsail Ubuntu instance and is reachable over HTTPS on a domain.

Deliver:
1. **Multi-stage `Dockerfile`** for the Next.js app — builder stage (install + `next build` with `output: 'standalone'`), minimal runtime stage (node:20-alpine or distroless), non-root user, only standalone output + static assets copied in. Healthcheck. Keep the image small (you know Alpine multi-stage well — apply it: pin base images, `--no-cache`, no build tools in final stage, correct `FROM ... AS ...` casing, LF line endings on any heredocs).
2. **`docker-compose.yml`** (production) wiring `proxy` (Caddy, ports 80/443, auto-TLS), `web` (Next.js standalone), `db` (postgres:16-alpine, named volume `oro_pgdata`), `worker` (reminders/cron). Healthchecks + `depends_on` with conditions. Restart policies `unless-stopped`. Networks: internal-only for db, only proxy exposed publicly.
3. **`docker-compose.override.yml`** / `docker-compose.dev.yml` for local dev (hot reload, optional MinIO for S3-compatible storage, mailhog/maildev for catching emails locally).
4. **`Caddyfile`** — reverse proxy to `web:3000`, automatic HTTPS, gzip/zstd, security headers.
5. **`.env.example`** — DATABASE_URL, NEXTAUTH_SECRET/AUTH_SECRET, AUTH_URL, app domain, SMTP_* (or RESEND_API_KEY), STORAGE_DRIVER (local|s3) + S3_* keys, ENCRYPTION_KEY, GOOGLE_*/LINKEDIN_* OAuth (optional), TWILIO_* (optional, P1), with comments on what's required vs optional for boot.
6. **Prisma migrations** + an entrypoint that runs `prisma migrate deploy` then `prisma db seed` (seed idempotent / dev-gated) before starting the server.
7. **`Makefile`** or `scripts/` with: `make up`, `make down`, `make logs`, `make migrate`, `make seed`, `make backup-db` (pg_dump to a mounted volume), `make restore-db`.
8. **`deploy/LIGHTSAIL.md`** — exact runbook: recommended instance size (start ≥2 GB RAM for Postgres + Next build headroom), choose an **EU region** (e.g. eu-central / eu-west — Frankfurt/Ireland) for GDPR data residency, open the Lightsail firewall for 80/443, point DNS A record at the static IP, set `.env`, `docker compose up -d`, verify TLS, run a backup. Note: if build RAM is tight, build the image elsewhere/CI and pull, or add swap.
9. **`README.md`** — architecture diagram (the 4 containers), local dev quickstart, prod deploy pointer, how to swap storage→S3/R2 and email→Resend via env, and a clear note that this is the self-hosted MVP intended to scale out to managed services later.
10. **GitHub Actions CI** (you do this daily): lint + typecheck + `prisma validate` + build the Docker image on PR; on tag/main, build and push the image to a registry (GHCR or Amazon ECR — leave registry configurable). Keep it simple.

Constraints: no service requires a paid SaaS to boot; everything persists across `docker compose down && up` via named volumes; `docker compose down -v` is the only thing that wipes data, and the runbook says so.

---

## 8. Build order (work in vertical slices, smallest shippable increments)

1. Repo scaffold: Next.js + TS + Tailwind, Prisma, Auth.js, Zod, project structure, lint/format, the frozen design tokens in the Tailwind config + a base layout matching the export.
2. Dockerize early: app Dockerfile + compose + Postgres + Caddy + Prisma migrate/seed wired so `docker compose up` serves a styled "it works" home at HTTPS locally. Get the container loop working before piling on features — it's cheaper to fix infra now.
3. Auth slice: register → email verify → login → forgot password, with the SMTP/email interface (use maildev locally). Role plumbing + server-side guards + a `requireRole()` helper.
4. Public surfaces: landing + services, pixel-matched to the export, SEO basics.
5. Onboarding core (highest value): service selection → dynamic conditional form (Zod-validated, draft autosave) → document upload (drag/drop, progress, server-side validation, encrypted storage via the StorageProvider) → success screen with `ORO-2026-XXXXX` reference. Write to prospects/prospect_details/documents + activity_log.
6. Client app: dashboard (status timeline), documents (per-doc status), messages thread, settings.
7. Admin app: submissions queue (filters/search) → submission detail (doc viewer, status controls, partner assign, internal notes, request-more-info checklist, approve/reject) → one-click convert to client → client profile (services, key dates, folders, notes, activity, quick actions) → bookings view → analytics computed from DB.
8. Booking module: availability/slots (2-week window), timezone handling, expert selection, .ics generation, confirmation email; unlock only when prospect approved.
9. Reminders worker: idempotent 24h/1h email reminders, key_dates upcoming→overdue flip. WhatsApp adapter as env-gated no-op.
10. Partner portal: read-only client views + notes, enforced server-side.
11. Hardening: rate limits, headers, RLS-equivalent authorization tests, responsive pass across all 9 viewports, the Lightsail runbook + backup/restore verified.

After each slice: it should build, the container should come up, and the slice should be demoable. Commit per slice with clear messages.

---

## 9. Before you code — produce this plan and wait for approval

1. Confirmed file/folder structure for the Next.js app (routes mapped to the 12 screens + the derived routes).
2. The full Prisma schema (§4) as a `schema.prisma` proposal.
3. The provider interfaces (`StorageProvider`, `EmailProvider`, `CalendarProvider`, `NotificationProvider`) with their default + swappable impls listed.
4. The `docker-compose.yml` service list with ports, volumes, networks, healthchecks.
5. Any place where the spec and the "self-hosted on Lightsail" constraint genuinely conflict, with your recommended resolution (default to self-hosted; flag it, don't silently pick SaaS).
6. The frozen design-token table you'll put in Tailwind.

Present that plan, list any assumptions, ask me only the questions you genuinely can't resolve from the PDF + design export, and **wait for my go-ahead before generating the codebase.**

---

### Notes on what's explicitly OUT of scope (don't build these)
Full CRM (pipeline/deal tracking/lead scoring), invoicing/payments, e-signatures, task management, blog/CMS beyond basic text editing, AI chatbot, multi-jurisdiction support. If you find yourself building any of these, stop.
