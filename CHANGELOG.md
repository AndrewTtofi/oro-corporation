# Changelog

All notable changes to the ORO platform that ship to `main` are recorded here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely and uses date-stamped sections rather than semver until the first production tag.

> **PR requirement:** every pull request that targets `main` must update this file before merge. The CI `Changelog updated` check verifies the diff touches `CHANGELOG.md`. See [`.github/pull_request_template.md`](./.github/pull_request_template.md).

---

## Unreleased

### Changed — Upgrade TypeScript to 6.0
- Bumped `typescript` 5.9 → 6.0.3. Removed the deprecated `baseUrl` from `tsconfig.json` (TS 6 deprecates it, TS 7 removes it); the `@/*` path mapping resolves fine without it since all source imports are either `@/*` or real packages. Added `src/types/assets.d.ts` declaring `*.css` to satisfy TS 6's stricter side-effect-import checking (TS2882) for `import "./globals.css"`.

### Changed — CI: exempt Dependabot from the changelog gate
- The `Changelog updated` check now skips Dependabot PRs (`github.actor != 'dependabot[bot]'`). Dependency bumps only touch manifests/lockfiles and never edit `CHANGELOG.md`, so the gate was failing every Dependabot PR. Human PRs still require a changelog entry.

### Changed — Unify all admin pages onto the prototype design system
- Converted every remaining `/admin` page off the older "Quiet Authority" tokens (`font-display`, `text-ink`, `--admin-*`, bespoke `Th`/`Td` table helpers, `min-w-[1000px]`) onto the prototype component system (`.card`, `.tbl`/`.tbl-wrap`/`.tbl-toolbar`, `.chips`/`.chip`, `.badge*`, `.kpi-tile`, `.dl`, `.file-row`, `.scrim`/`.modal*`, `.field`/`.input`). The whole admin surface now shares one look.
  - Lists/detail: clients (list + full client detail: header, tabs, key-dates, compliance bar, conversation, folders, modals), submissions (queue + detail + actions + party workspace), users, analytics (shared KPI tiles), messages, content editor.
  - Settings: layout, chip-tab nav, and branding form.
- Fixed the clients table clipping off-screen (removed the forced `min-w-[1000px]`; `.tbl-wrap` now scrolls). Restored content padding on the standalone submission-detail page (wrapped in `.appmain`).
- Added the prototype `.file-row` styles to globals.css (the only class that was missing).

### Changed — Pricing page
- Refreshed `/pricing` styling to the prototype's card layout (responsive `price-grid`, available/unavailable feature markers, "Most popular" highlight) while keeping the **firm's own service pricing** (Essentials / Standard / Full service, setup-fee + monthly retainer).
- Note: the new prototype's pricing page sells the white-label *platform* to firms with a monthly/annual SaaS toggle. That model is intentionally **not** used in tenant builds — each deployment is white-labelled for one firm and must show that firm's service pricing to its clients, not the platform's subscription tiers. The platform toggle was therefore dropped from the app.

### Added — Compliance suite (new prototype)
- New **Compliance hub** (`/admin/compliance`): KPI tiles (active onboardings, KYC pending, AML flags, UBOs), a suite grid linking the eight tools, a "cases needing attention" table and a compliance-posture summary (applicants screened, raw vendor hits, true matches, structures mapped, overdue obligations). Wired to live prospects.
- Six new compliance tools, each built on deterministic intelligence derived from real prospects (`src/lib/services/compliance-intel.ts`) and gated by plan tier:
  - **KYC / ID verification** (`/admin/compliance/kyc`) — document + biometric liveness/face-match results per applicant (Scale).
  - **KYB verification** (`/admin/compliance/kyb`) — registry records for corporate applicants: legal status, type, directors, filings, with a link to the ownership map (Scale).
  - **AI screening** (`/admin/compliance/ai-screening`) — collapses raw sanctions/PEP/adverse-media hits into true matches, showing the noise-reduction (Scale).
  - **Ownership map** (`/admin/compliance/ownership`) — recursive UBO tree with effective-ownership math (multiplied down the tree) and ≥25% UBO flagging (Scale).
  - **Client risk** (`/admin/compliance/risk`) — 0–100 risk scoring across the portfolio with driver breakdown (Scale).
  - **AML reporting** (`/admin/compliance/reporting`) — SAR/STR, periodic-review and UBO-confirmation report templates plus a recent-reports log (Scale).
- New **Documents & e-sign** (`/admin/documents`, Professional): firm-wide document library with version history, expiry tracking, e-signature templates and a dropzone. New **Connect & API** (`/admin/integrations`, Scale): connected-services grid, webhooks table and branded API keys.
- Provider-side actions that require live third-party wiring (generate report, refresh from registry, connect/regenerate keys, send for signature, upload) are labelled **coming soon**; the UI mirrors the prototype exactly.
- Rebuilt the admin sidebar to the full prototype IA (Overview / Compliance / Relationships / Engagement / Firm / Configure), persona- and tier-aware.

### Added — AI Advisor (new prototype)
- `/advisor`: a conversational AI advisor (free, no sign-up) that matches a free-text need to a recommendation. Keyword intent tree (`src/lib/data/advisor.ts`) with clarify chips and branch routing; renders a recommendation card (service(s) + primary jurisdiction with corp/VAT/formation stats + "also strong" alternatives) and CTAs (Start application, See matching providers, Compare jurisdictions). Added "Advisor" (AI badge) to the public nav.
- Shared `Icon` component (`src/components/Icon.tsx`, full prototype icon set) and `services` data module for reuse across the new features.


### Added — Partner-network marketplace (new prototype)
- Marketplace of 20 vetted partners (banks/EMIs, corporate services, advisory, licensing) for visitors and clients: category tabs, search, jurisdiction/industry/speed filters, remote toggle, sort, grid/list views, provider detail modal, compare (up to 3) modal, and concierge. `/marketplace` (public) + `/app/marketplace` (client).
- "Get started" applies to a partner (persisted via new `Application` model + `POST /api/applications`); clients track them under **My applications** (`/app/applications`). Reuses the verified KYC profile messaging.
- Nav: "Partner network" in the public nav; "Network" group (Partner network + My applications) in the client sidebar.


### Added — Super-admin provisioning via GitHub secrets → .env
- The platform super-admin is now configured entirely through GitHub secrets and injected into the prod box at deploy time (no hand-editing the box):
  - `SUPER_ADMIN_EMAILS` and `SUPER_ADMIN_PASSWORD` are passed from secrets through `deploy.yml` (over SSH) and written into `/opt/oro/.env` by `deploy/deploy-oro.sh` (idempotent `upsert_env`).
  - New idempotent `src/worker/ensure-super-admin.ts` (compiled to `dist-worker`) runs every deploy and upserts each `SUPER_ADMIN_EMAILS` entry as a verified `staff` user (password from `SUPER_ADMIN_PASSWORD` on first create; existing accounts promoted to staff without password reset).
- Configured `ttofisandreas@gmail.com` as the production super admin.

### Added / Changed — Align admin to the platform prototype
- New **admin Dashboard** landing (`/admin`) with KPI tiles, a recent-submissions table and a recent-activity feed (was a redirect to the submissions queue).
- New **unified Messages inbox** (`/admin/messages`): a 2-pane thread list + conversation (reuses the client-detail `ConversationView`, replies via the existing messages API).
- **AML / KYC screening panel inline** on the submission detail (Scale-gated; shows a locked note below Scale), plus a **Regenerate** control on the AI brief.
- **Client-facing brief-completeness meter** in the onboarding header, computed live from the draft.
- Reorganised the admin sidebar (Overview / Relationships / Compliance / Firm) and **removed the Compliance *tasks* queue** UI section (`/admin/compliance/tasks`); the ReviewTask model, API route and worker jobs are unchanged.
- Note: the prototype's pricing monthly/annual toggle was intentionally not ported — the public pricing page reflects the firm's setup-fee + retainer model, where a billing-period toggle doesn't apply.

### Added — Two admin personas (platform admin vs staff admin)
- Split the admin surface into two personas, both on the `staff` DB role, distinguished by the `SUPER_ADMIN_EMAILS` env allowlist (set by the platform operator at deploy time):
  - **Platform admin** (super admin, the code owner) sees **only** the Settings area (`/admin/settings/*` — branding, plan, services, team, flags).
  - **Staff admin** (everyone else) sees **everything except** Settings.
- Enforced in `middleware.ts` by path: a super admin hitting any non-settings `/admin` route is redirected to `/admin/settings`; a staff admin hitting settings is redirected to `/admin`. The settings layout also guards with `requireSuperAdmin()`, and `PATCH /api/admin/settings/org` rejects plan-tier changes from non-super-admins (403). The admin sidebar shows each persona only its own nav.
- The plan tier is therefore operator-controlled and edited in **Settings → Branding & plan** (prototype tier-card UI). Helpers `isSuperAdmin()` / `currentIsSuperAdmin()` / `requireSuperAdmin()` in `src/lib/auth/guards.ts`; JWT now carries `email` for the middleware check.

### Changed — Repository renamed to `fiduciary-software`
- Renamed the GitHub repo `oro-corporation` → `fiduciary-software`. CI derives the GHCR image path from the repo name automatically; updated the one hardcoded image reference in `deploy/deploy-oro.sh` to `ghcr.io/andrewttofi/fiduciary-software:latest` so deploys keep matching the freshly-built image. Updated clone/wiki URLs in the README and getting-started docs. GitHub redirects keep old URLs working.

### Added — White-label platform features
- White-label branding: configurable brand name, wordmark letter, accent colour and theme preset (indigo/emerald/gold/burgundy/slate), applied app-wide via injected CSS variables (`src/lib/services/branding.ts`). New **Settings → Branding & plan** tab with live preview.
- Plan tiers (Starter/Professional/Scale) with feature gating: partner portal + compliance calendar require Professional; AML screening requires Scale. `tierAtLeast()` helper, `UpgradeGate` component, tier-aware admin nav.
- Public lead-magnet tools: **jurisdiction comparison** (`/tools/compare`, 18 jurisdictions, sortable, best-value highlight) and **tax calculator** (`/tools/calculator`, email-gated reveal → creates a CRM lead). Corporate-tax and VAT figures verified against PwC Worldwide Tax Summaries with per-row source links (reviewed June 2026).
- CRM: `Lead` model + `/admin/crm` unified pipeline (leads/applicants/clients); public `POST /api/leads` capture.
- AI-generated internal brief + auto-computed completeness score (low/med/high) on submissions, with a staff override and a Brief column in the queue (`src/lib/services/prospect-intel.ts`).
- Compliance calendar (`/admin/compliance/calendar`) and AML screening (`/admin/compliance/aml`), both tier-gated.
- Editable marketing content (CMS-lite): `SiteContent` model + **Settings → Content** editor (hero, steps, stats, testimonials, CTA, FAQ); landing page and FAQ read from it live.

### Added — Ops & notifications
- Discord deploy notifications: `notify-discord` workflow posts a plain-language "what changed" forum summary (from the changelog) after a successful deploy; editable templates in `scripts/notify-deploy/`.
- Dependabot (`.github/dependabot.yml`): weekly grouped updates for npm, GitHub Actions and Docker.

### Fixed — Admin UI
- Client document folders showed raw service keys (`company_formation`) instead of labels — the page now seeds/reads the service taxonomy via `getServices()` with a humanize fallback.
- Client **Services** tab rows were misaligned in the narrow content column — restructured into a card with an aligned name+actions header and equal Status/Partner/Notes columns.
- Disabled the Next.js dev indicator that overlapped the sidebar "Log out".

### Changed — "Quiet Authority" redesign (full)
- Re-skinned the design system from the warm "private-bank" serif aesthetic to the platform prototype: indigo brand (`#2E4A8B`) + champagne-gold accent (`#C9A86A`), cool light-gray surfaces, navy ink, **system sans** (dropped Fraunces serif), rounded 6–8px corners, navy-tinted shadows.
- `tailwind.config.ts` + `globals.css` retoken (names kept stable so utilities re-skin without edits); added prototype component classes (card/kpi/table/timeline/bubble/note/chip/avatar/sidebar/appbar/auth).
- **Marketing** rebuilt to prototype layout: home (hero/3-step/services/proof/testimonials/CTA), services, pricing, FAQ; new **Terms** + **Privacy** pages; public nav + dark footer.
- **Sign-in** rebuilt to a centered auth card; `Logo` → sans wordmark (auth + onboarding).
- **Client portal**: light sidebar + appbar shell; dashboard, prospect dashboard, and sub-pages aligned (KPI cards, brand timeline, message bubbles, badges).
- **Admin app**: light sidebar + appbar shell; submissions/clients/compliance + client detail headings to plain bold sans; conversation bubbles → brand.

### Fixed
- Client login redirected to `/app`, which had no index page → 404. Added `/app` → `/app/dashboard` redirect.

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
