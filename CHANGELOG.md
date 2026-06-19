# Changelog

All notable changes to the ORO platform that ship to `main` are recorded here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely and uses date-stamped sections rather than semver until the first production tag.

> **PR requirement:** every pull request that targets `main` must update this file before merge. The CI `Changelog updated` check verifies the diff touches `CHANGELOG.md`. See [`.github/pull_request_template.md`](./.github/pull_request_template.md).

---

## Unreleased

### Added — Self-hosted deploy pipeline
- `deploy/deploy-oro.sh` — idempotent ORO deploy (pulls prebuilt GHCR image, self-signed HTTPS on :443 + HTTP on :80, persistent `.env`, proxy re-resolve).
- `.github/workflows/deploy.yml` — `deploy-oro` workflow on a self-hosted runner (`oro-ci`); SSHes to the ORO host over the private network and runs the deploy. Triggers on CI success on `main` + manual dispatch.
- `docker-compose.prod.yml` — single-host hardening overlay (resource caps, log rotation, no-new-privileges, pids limits).
- `deploy/SERVER.md` — generic Ubuntu server runbook; `deploy/backup.sh` + systemd units for nightly db+docs+secrets backups; `make backup-all` / `restore-all`.

### Fixed — CI
- `e2e/messaging.spec.ts` used the **client** composer's selectors against the **staff** page — wrong textarea placeholder (`Type a message…` vs `Address the client. Be precise.`) and a button matcher (`/^send$/i`) that never matched the actual `Send →` button. Fixed both; this was the only red E2E test (pre-existing) and blocked the green CI gate that auto-deploy depends on.

### Added — Bucket-A polish (PR #4)
- Hit-review status pill per party on the compliance file dashboard: shows "N to review" in red when unreviewed hits exist.
- "Last screened / next due" per-party indicator with risk-band cadence math (high=30d, standard=90d, low=365d); turns red when overdue.
- Doc purpose dropdown on admin upload (replaces silent default); staff can pick passport / proof_of_address / source_of_funds / other before choosing a file.
- "No-delete" audit note on the client documents page.
- Edit DocumentRequest before fulfilment — modal on `/admin/clients/[id]/request-docs` pre-filled with description + dueAt; calls PATCH route.
- Risk-override history block on the compliance RiskPanel (collapsible `<details>`, last 10 overrides).

### Fixed — Bucket-A bug fixes
- `assign-partner` route now rejects non-partner target users with 400 (was accepting any UUID).
- `auto-rescreen` outer query widened from 365d to 30d so high/standard-band cases are no longer excluded from the per-tick sweep.
- `ActivityAction` union gains `doc_request.updated`.

### Added — Test hardening (PR #4)
- Vitest projects split into `unit` (fast, mocked Prisma) and `integration` (real Postgres via @testcontainers/postgresql).
- ~270 new tests across API routes (~30 routes, 4-6 tests each), worker jobs (auto-rescreen, periodic-review, backfill-compliance), service-layer (screening, client-portal migrated to real DB).
- 8 Playwright E2E specs (`auth`, `onboarding-submit`, `convert-to-client`, `messaging`, `doc-request`, `compliance-gate`).
- NODE_ENV-guarded `/api/test/reset?seed=1` route for E2E DB resets + seed; `ALLOW_TEST_RESET=1` env var allows enabling against dev stack.
- Test-only `/api/test/setup-client` route for fast compliance clearance in E2E.
- Rate-limiter bypass when `ALLOW_TEST_RESET=1` so E2E doesn't blow through the 5/10-min auth limit.
- CI gains `integration` (testcontainers) and `e2e` (docker stack + Playwright) jobs.
- Playwright HTML report uploaded as artifact on failure.

### Fixed
- `wrapTx` (test helper) now supports both callback and array forms of `prisma.$transaction(...)`.

### Concerns surfaced (not fixed in this PR)
- `src/worker/jobs/auto-rescreen.ts`: the outer `findMany` filter uses a 365-day floor that excludes high/standard-risk cases (cadence 30d/90d) whose latest run is younger than 365d but older than their band cadence. Per-case `cutoffForBand` check is correct but unreachable for these cases. Tracked for follow-up.
- `src/app/api/admin/submissions/[id]/assign-partner/route.ts`: accepts any user UUID as `partnerId` without verifying the target's role. Tracked for follow-up.

### Added — Client portal v1 (PR #3, branch `feature/client-portal`)
- Role-aware `/app/dashboard`: prospects keep the existing submission view; converted clients now see active services, upcoming key dates (next 30 d), open document requests, recent staff messages (7 d), recent activity, and a "book a follow-up" CTA when no booking is scheduled in the next 14 d.
- `/app/messages`: unified read (`Message.prospectId` OR `Message.clientId`) so messages staff sent from the admin side after conversion are finally visible to the client; composer posts to the new `/api/account/messages`; staff bubbles are now visually distinct from peer/system bubbles.
- `/app/documents`: rewritten per-folder layout matching the admin view. Open `DocumentRequest`s render with inline `Upload` buttons that atomically fulfil the request; clients can also upload arbitrary documents into any service folder via the `Upload a document` modal.
- `/app/application`: small notice for converted clients pointing them to Dashboard for current service status.
- `/app/settings`: new "Company" section for clients — editable `address`, `taxResidency`; read-only `companyName`, `registrationNumber`, `vatNumber`, `engagementLetterDate` with "contact your account manager" hint.
- New service layer `src/lib/services/client-portal.ts`: `getMessagesForUser`, `sendClientMessage`, `updateClientSelfProfile`, `uploadClientDocument` (ownership-checked).
- New API routes: `POST /api/account/messages`, `POST /api/account/documents`. Extended `POST /api/account/profile` to accept `address` + `taxResidency`.
- Activity action: `client.self_profile_updated`.

### Process
- Added `CHANGELOG.md` (this file) plus enforcement via `.github/workflows/ci.yml` and `.github/pull_request_template.md`.

---

## 2026-05-24 — Client detail page full functionality (PR #2)

### Added — `/admin/clients/[id]` rewrite
- `EditableClientHeader`: inline edit for `companyName`, `country`, `address`, `registrationNumber`, `vatNumber`, `taxResidency`, `engagementLetterDate`, plus `User.phone`.
- `ComplianceBar`: status + risk-rating pill + link to the (previously orphaned) `/admin/clients/[id]/compliance` page.
- Services Engaged: inline edit (status / partner / notes), `+ Add service` modal (pulls active services from the DB-backed taxonomy), Remove.
- Key Dates: edit / mark complete / delete, with `Hide completed` filter chip.
- Documents: per-folder sections under real `<section id="docs-X">` anchors. Staff upload, view inline (via `/api/documents/[id]`), set status (`received` / `under_review` / `approved` / `reupload_needed`), delete. Open `DocumentRequest`s render inline per folder with cancel.
- `ReassignModal` replaces the previous `alert()` placeholder; reassigns primary staff via PATCH.
- All four `QuickActions` are now real links (Send Message, Request Docs, Add Service, Add Key Date).

### Added — Messaging + document requests (Phase 2)
- `/admin/clients/[id]/messages` thread page + composer; `sendMessage` service writes the row and best-effort emails the client.
- `/admin/clients/[id]/request-docs` page + form; `createDocumentRequest` writes the row and emails the client. Cancel and (via the new fulfillment seam in `uploadDocument`) automatic fulfilment supported.

### Schema
- `Client`: `country`, `address`, `registrationNumber`, `vatNumber`, `taxResidency`, `engagementLetterDate`.
- `Document.serviceTypeKey`: optional service-folder bucketing key.
- New model `DocumentRequest` (state: `open` / `fulfilled` / `cancelled`).

### Fixed (from final review)
- `DocumentRow` iframe URL was `/app/documents/[id]` (a list page); corrected to `/api/documents/[id]`.
- `uploadDocument` now accepts `purpose: DocPurpose` so the KYC folder actually receives KYC documents from staff uploads.
- `PATCH /api/admin/clients/[id]`: pre-validation of client + primary-staff target to prevent partial multi-write state.
- `POST /api/admin/clients/[id]/document-requests`: returns 404 (not 500) when the client doesn't exist.

---

## 2026-05-24 — KYC / AML compliance subsystem (PR #1)

### Added
- `ComplianceFile` aggregate per Prospect / Client; per-party `KycCase`; `ScreeningRun` + `ScreeningHit`; `ReviewTask`.
- OpenSanctions integration (free public API, optional paid key) with retry + threshold filtering.
- Rules-based risk scoring (`computeRisk`): geo + PEP + industry + complexity + turnover factors; bands `low` (0–2) / `standard` (3–5) / `high` (6+); FATF blacklist forces `high`; confirmed sanctions hit forces `blocked`.
- Worker cron jobs: hourly auto re-screening (cadence by risk band) and daily periodic-review reminders. Backfill on worker boot creates ComplianceFile rows for pre-existing Prospects/Clients.
- Conversion gate: `convertProspectToClient` blocks when ComplianceFile is not `cleared`; ConvertModal shows per-candidate compliance pill.
- Admin UI: `/admin/clients/[id]/compliance`, `/admin/submissions/[ref]/compliance`, per-party workspace with IDV checklist + screening review, `/admin/compliance/tasks` cross-file queue.

### Schema
- 6 new models (ComplianceFile, Party, KycCase, ScreeningRun, ScreeningHit, ReviewTask) + Document/User extensions; `DocPurpose` enum (`passport` / `proof_of_address` / `sof` / `other`).

### Process
- Added Vitest (`vitest`, `vite-tsconfig-paths`) and the first 33 tests covering pure logic + services.
- CI workflow (`.github/workflows/ci.yml`): lint + typecheck + prisma validate.
- Switched to `legacy-peer-deps` for `npm ci` to reconcile the `next-auth@5-beta` vs `@auth/core` nodemailer peer-dep conflict.
