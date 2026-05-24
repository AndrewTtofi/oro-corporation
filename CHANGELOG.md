# Changelog

All notable changes to the ORO platform that ship to `main` are recorded here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely and uses date-stamped sections rather than semver until the first production tag.

> **PR requirement:** every pull request that targets `main` must update this file before merge. The CI `Changelog updated` check verifies the diff touches `CHANGELOG.md`. See [`.github/pull_request_template.md`](./.github/pull_request_template.md).

---

## Unreleased

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
