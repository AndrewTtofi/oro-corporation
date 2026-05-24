# KYC / AML Compliance — Design

**Date:** 2026-05-24
**Author:** Brainstormed with Claude (superpowers:brainstorming)
**Status:** Approved — ready for implementation plan
**Scope cluster:** First of four (KYC/AML → Compliance calendar → Billing → Client self-service portal)

---

## 1. Purpose

Add a regulator-defensible KYC/AML capability to the ORO fiduciary platform that:

- Identifies and verifies every relevant party to a client relationship (main contact + UBOs ≥ 25% + directors + signatories), per AMLD5.
- Screens each party against sanctions, PEP, and (where available) adverse-media lists at onboarding and on a risk-based cadence.
- Produces a documented, consistently-applied risk rating per client (Low / Standard / High) with reviewer override.
- Exposes a per-client **ComplianceFile** that a CySEC inspector can be handed as-is.
- Hard-gates: a Client cannot be created from an approved Prospect until its ComplianceFile is `cleared`.

This spec is the first of four sub-projects in the wider "fiduciary management system" build. It is intentionally scoped to *not* include: customer-facing compliance UX, e-signing, multi-jurisdiction methodology variants, or paid screening providers. Those are explicit deferrals (see §11).

---

## 2. Design decisions captured during brainstorm

| Decision | Choice | Reason |
|---|---|---|
| Identity verification | Staff-only review of uploaded docs | No third-party cost; defensible for early scale |
| Sanctions/PEP screening | OpenSanctions free API | Defensible coverage (US OFAC / EU / UN / UK / PEP); no recurring cost |
| Scope of KYC | Main contact + all related parties (UBO ≥ 25%, directors, signatories) | AMLD5 compliance from day one |
| Risk scoring | Rules-based score + staff override w/ reason | Consistent methodology; reviewer judgement retained |
| Ongoing monitoring | Scheduled auto re-screening + risk-based review tasks | Cheap to automate via OpenSanctions; defensible audit trail |
| Architecture | `ComplianceFile` aggregate, sibling to `Client`/`Prospect` | One canonical home; minimal blast radius on existing flows |
| Conversion gate | Hard-block: Client cannot be created until ComplianceFile is `cleared` | Matches regulator expectation; no `pending_compliance` Client state needed |

---

## 3. Data model

### 3.1 New tables

**`ComplianceFile`** — aggregate root, one per Prospect/Client (the same file follows the entity through conversion).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `prospectId` | uuid? unique | One of {prospectId, clientId} non-null at any time; both set after conversion |
| `clientId` | uuid? unique | |
| `status` | enum `ComplianceStatus` | `open` → `in_review` → `cleared` / `blocked` |
| `signedOffById` | uuid? → User | Set when signed off |
| `signedOffAt` | datetime? | |
| `signedOffNote` | string? | Required for sign-off |
| `riskComputed` | enum `RiskRating`? | What the rules said |
| `riskComputedScore` | int? | Numeric 0–14 |
| `riskRating` | enum `RiskRating`? | What staff confirmed/overrode |
| `riskOverrideReason` | string? | Required when `riskRating ≠ riskComputed` |
| `riskAssessedAt` | datetime? | |
| `riskAssessedById` | uuid? → User | |
| `createdAt`, `updatedAt` | datetime | |

Enums:
- `ComplianceStatus`: `open` | `in_review` | `cleared` | `blocked`
- `RiskRating`: `low` | `standard` | `high`

**`Party`** — many per ComplianceFile.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `complianceFileId` | uuid → ComplianceFile, cascade | |
| `type` | enum `PartyType` | `individual` \| `entity` |
| `role` | enum `PartyRole` | `main_contact` \| `ubo` \| `director` \| `shareholder` \| `signatory` \| `intermediary` |
| `fullName` | string | |
| `dateOfBirth` | datetime? | Required for individuals to screen meaningfully |
| `nationality` | string? | ISO 3166-1 alpha-2 |
| `countryOfResidence` | string? | ISO 3166-1 alpha-2 |
| `passportNumber` | string? | |
| `registrationNumber` | string? | For entities |
| `jurisdiction` | string? | For entities, ISO 3166-1 alpha-2 |
| `ownershipPct` | decimal? | For UBO / shareholder |
| `isPep` | boolean | Default false. Manually editable. Auto-flipped to `true` when a `ScreeningHit` with topic `role.pep` on this party transitions to `confirmed_match` (one-way; staff can still un-flip manually with an activity log entry). |
| `createdAt`, `updatedAt` | datetime | |

**`KycCase`** — one-to-one with Party.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `partyId` | uuid → Party, unique, cascade | |
| `idvStatus` | enum `KycCheckStatus` | `pending` \| `verified` \| `failed` |
| `idvReviewedById` | uuid? → User | |
| `idvReviewedAt` | datetime? | |
| `idvNote` | string? | Required on `failed` |
| `passportDocId` | uuid? → Document | |
| `proofOfAddressDocId` | uuid? → Document | |
| `sofDocId` | uuid? → Document | Source-of-funds; required only for `high` risk |
| `sofNote` | string? | |
| `latestScreeningRunId` | uuid? → ScreeningRun | Denormalised for fast reads |
| `state` | enum `KycCaseState` | Derived state machine: `pending` \| `in_progress` \| `passed` \| `blocked` |
| `createdAt`, `updatedAt` | datetime | |

Enums:
- `KycCheckStatus`: `pending` | `verified` | `failed`
- `KycCaseState`: `pending` | `in_progress` | `passed` | `blocked`

**`ScreeningRun`** — many per KycCase; immutable history.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `kycCaseId` | uuid → KycCase, cascade | |
| `provider` | string | `"opensanctions"` (free-text; we don't enum since providers swap) |
| `query` | JSON | Inputs used (name, DOB, nationality, schema) — for audit |
| `ranAt` | datetime | |
| `ranByActorId` | uuid? → User | Null = automated (cron) |
| `outcome` | enum `ScreeningOutcome` | `clear` \| `hits` \| `error` |
| `hitCount` | int | |
| `rawResponse` | JSON? | Full provider response for audit; not redacted |
| `errorMessage` | string? | Set when `outcome=error` |

Enum:
- `ScreeningOutcome`: `clear` | `hits` | `error`

**`ScreeningHit`** — many per ScreeningRun.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `screeningRunId` | uuid → ScreeningRun, cascade | |
| `externalId` | string | Provider's stable ID (e.g. OpenSanctions `NK-xxx`) |
| `matchedName` | string | |
| `matchedSchema` | string | `"Person"` / `"Organization"` |
| `matchedTopics` | string[] | `["sanction", "role.pep", "crime.terror", ...]` |
| `matchScore` | float | 0.0–1.0 |
| `matchedListings` | JSON | Raw datasets section of the match |
| `matchUrl` | string? | Public lookup URL |
| `reviewStatus` | enum `HitReviewStatus` | `unreviewed` \| `false_positive` \| `confirmed_match` \| `escalated` |
| `reviewedById` | uuid? → User | |
| `reviewedAt` | datetime? | |
| `reviewNote` | string? | Required on `confirmed_match` or `escalated` |

Enum:
- `HitReviewStatus`: `unreviewed` | `false_positive` | `confirmed_match` | `escalated`

**`ReviewTask`** — many per ComplianceFile.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `complianceFileId` | uuid → ComplianceFile, cascade | |
| `kind` | enum `ReviewTaskKind` | `periodic_review` \| `screening_hit` \| `id_doc_review` \| `risk_assessment` |
| `dueAt` | datetime? | |
| `state` | enum `ReviewTaskState` | `open` \| `completed` \| `dismissed` |
| `assignedToId` | uuid? → User | |
| `note` | string? | |
| `completedAt` | datetime? | |
| `createdAt` | datetime | |

Enums:
- `ReviewTaskKind`: `periodic_review` | `screening_hit` | `id_doc_review` | `risk_assessment`
- `ReviewTaskState`: `open` | `completed` | `dismissed`

Indexes:
- `ReviewTask`: `(complianceFileId, state)`, `(assignedToId, state)`

### 3.2 Existing-model touches

- **`Document`**: add `partyId: uuid? → Party` (nullable for backward compatibility) and `purpose: enum DocPurpose` (`passport` | `proof_of_address` | `sof` | `other`; defaults to `other`). Existing documents become `purpose='other'` on backfill.
- **`Prospect`**: gains relation accessor for ComplianceFile (no FK on Prospect itself; the FK lives on ComplianceFile).
- **`Client`**: same.
- **`User`**: new back-relations for `signedOff`, `idvReviewedBy`, `ranByActor`, `reviewedHits`, `assignedTo`, `assessedRisk`. Implementation cosmetic only.

---

## 4. OpenSanctions integration

### 4.1 Provider abstraction

`src/lib/providers/screening.ts` defines a `ScreeningProvider` interface mirroring the existing `StorageProvider`/`EmailProvider` pattern. Default implementation `OpenSanctionsProvider`; swappable by `SCREENING_DRIVER` env.

```
interface ScreeningProvider {
  match(input: ScreeningQuery): Promise<ScreeningResponse>;
}
```

### 4.2 Endpoint + inputs

- `POST https://api.opensanctions.org/match/default`
- Optional `Authorization: ApiKey ${OPENSANCTIONS_API_KEY}` for paid tier (no code change beyond the header).
- Per party query shape:
  - Individual → `{ schema: "Person", properties: { name, birthDate?, nationality? } }`
  - Entity → `{ schema: "Organization", properties: { name, jurisdiction?, registrationNumber? } }`

### 4.3 Threshold

- Configurable env `SCREENING_MATCH_THRESHOLD` (default `0.7`).
- Matches with `score >= threshold` become `ScreeningHit` rows.

### 4.4 Runner

`runScreening(kycCaseId: string, opts: { actorId?: string | null }): Promise<ScreeningRun>` in `src/lib/services/compliance/screening.ts`.

- Writes one `ScreeningRun` row, calls provider, persists hits.
- Updates `KycCase.latestScreeningRunId` and (when appropriate) `KycCase.state`.
- Network error → `outcome=error` with `errorMessage`; **does not** change `KycCase.state`.
- 250 ms throttle between successive provider calls; 3-retry exponential backoff on `429`/`5xx`.

### 4.5 Hit dedup for ongoing monitoring

On auto re-screening: only create a `ReviewTask(kind='screening_hit')` when at least one of:
- a hit with a `externalId` not present in the previous successful run, OR
- a hit with a topic not present for that `externalId` in the previous run (e.g. went from `role.pep` to `sanction`).

Manual one-off screens always render all current hits in the UI regardless of dedup.

### 4.6 Triggers

- Manual: "Run screening" button on a KycCase.
- Automatic: worker cron (§ 6).

---

## 5. Risk scoring

### 5.1 Function

`computeRisk(complianceFileId: string): { score: number; rating: RiskRating; factors: Record<string, number> }` in `src/lib/services/compliance/risk.ts`. Pure over current DB state; no I/O.

### 5.2 Factors (each 0–3; sum max 14)

| Factor | Source | Mapping |
|---|---|---|
| `geo` | Max over each party's residence + nationality + entity jurisdiction | Country-risk table seeded from FATF + EU lists, at `src/lib/services/compliance/data/country-risk.ts` |
| `pep` | Party PEP flags + screening | any party PEP = 2; main contact PEP = 3 |
| `industry` | Onboarding `businessActivity` → category lookup | `data/industry-risk.ts` (gambling/crypto/cash-intensive/arms = 3; consulting/services = 0) |
| `structure_complexity` | Party counts + nominee flag + entity layers | Heuristic: `parties > 5` → 2; nominees → +1; >2 entity layers → 3 |
| `turnover` | Existing `expectedTurnover` enum on Prospect | `<50K`=0, `50K-200K`=1, `200K-500K`=1, `500K-1M`=2, `1M+`=3 |

### 5.3 Bands

- 0–2 → `low`
- 3–5 → `standard`
- 6+ → `high`

(Initial draft used 0–3 / 4–7 / 8+ but the test scenarios — e.g. "Cyprus crypto exchange with €1M+ turnover" — sum to ~6 with the current factor weights, and *should* be `high` per regulator expectation. The tightened bands keep the high-risk signal usable; if factor weights are later inflated, revisit.)

### 5.4 Hard overrides (bypass score)

- Any `ScreeningHit` with `reviewStatus='confirmed_match'` AND a `sanction` topic → ComplianceFile.status forced to `blocked`; rating moot.
- Any party with jurisdiction/residence/nationality in the FATF blacklist subset (any country with `country-risk.ts` value of `3`) → forced `high` regardless of score.

### 5.5 Persistence

- Writes `riskComputed`, `riskComputedScore`, `riskAssessedAt`, `riskAssessedById` on every compute.
- `riskRating` and `riskOverrideReason` are written only when staff confirms or overrides (separate endpoint).
- ActivityLog entries `risk.assessed` and `risk.overridden` with meta `{ before, after, reason, escalated: boolean }`. No separate history table.

### 5.6 Override rules

- Reviewer can move the rating up or down with a written reason.
- Downgrades (high → standard, standard → low) are marked `escalated: true` in the activity meta so they're queryable for audit.
- Sign-off requires `riskRating` to be set AND no `unreviewed` hits across any KycCase in the file.

### 5.7 Re-compute triggers

- Party added/edited
- ScreeningHit `reviewStatus` changed
- Manual "Re-compute" button

---

## 6. Ongoing monitoring (worker cron)

Extends `src/worker/index.ts` (existing node-cron). Two new jobs.

### 6.1 Auto re-screening — hourly

- Query: `KycCase` where `state='passed'` AND `latestScreeningRun.ranAt < (now − cadence)`.
- Cadence (joined through Party → ComplianceFile → `riskRating`):
  - `high` = 30 days
  - `standard` = 90 days
  - `low` = 365 days
- Cases without a rating are excluded (initial-flow concern).
- For each: `runScreening(kycCaseId, { actorId: null })` with the runner throttle.
- Diff vs previous run → upsert `ReviewTask(kind='screening_hit')` per §4.5. Uniqueness key `(complianceFileId, kind, kycCaseId, state='open')`.

### 6.2 Periodic review reminders — daily 06:00 UTC

- Query: `ComplianceFile` where `status='cleared'` AND no open `ReviewTask(kind='periodic_review')` AND last completed `periodic_review` older than:
  - `high` = 180 days
  - `standard` = 365 days
  - `low` = 730 days
- Upsert `ReviewTask(kind='periodic_review', dueAt=now+14d)`.

### 6.3 Notifications

- MVP: tasks surfaced only in admin UI — a Compliance Tasks badge in `AdminShell` + dedicated `/admin/compliance/tasks` queue page.
- Future: layer on email/WhatsApp via the existing `NotificationProvider`. No schema change needed.

### 6.4 Observability

- Per tick: log job name, cases checked, tasks created, duration.
- Per-case `try/catch` so one failure doesn't kill the tick; errors logged with `kycCaseId` + message.

### 6.5 Idempotency

- Re-screening always writes a new `ScreeningRun` (history is the point).
- Task creation upserts on the uniqueness key.

---

## 7. UI

### 7.1 New routes

**A. `/admin/clients/[id]/compliance` — ComplianceFile dashboard**

Sections, top-to-bottom:
1. **Status banner** — color-coded for `open` / `in_review` / `cleared` / `blocked`.
2. **Risk panel** — computed score + factor breakdown ("Geo 2, PEP 0, Industry 1, …"), current rating, override dropdown + reason field, "Re-compute" button. Disabled when `blocked`.
3. **Parties table** — name, role, KycCase state, latest screening outcome (`clear` / `hits N` / `not run`), "Open" link. **+ Add Party** modal.
4. **Open Tasks** — `ReviewTask`s for this file with kind, due date, assignee.
5. **Sign-off panel** — button enabled only when every party's KycCase is `passed`, no `unreviewed` hits remain, and `riskRating` is set. Sign-off requires a note.
6. **Activity timeline** — filtered to `compliance.*` actions.

**B. `/admin/clients/[id]/compliance/parties/[partyId]` — Per-party workspace**

- Header: party metadata + role chip.
- Two-column layout:
  - **Left = doc viewer.** Passport on top, proof-of-address below, source-of-funds collapsed by default. PDFs/images served inline via the existing signed-URL doc route — no new download path.
  - **Right = checklist + actions:**
    - IDV checklist (face matches photo / not expired / name match / DOB match / doc looks authentic / POA recent (<3 months) / address match) + note + "Mark Verified" / "Mark Failed". Failure requires a reason.
    - Source of funds — optional doc upload + note; only enforced for `high` risk.
    - Screening section — latest run summary; hits list with per-hit review controls + note; "Run new screening" button.
- Activity log filtered to this party.

**C. `/admin/compliance/tasks` — cross-file task queue**

- Filterable list of all open `ReviewTask`s.
- Grouping by kind + risk band.
- Click-through to the relevant party workspace or file dashboard.

### 7.2 Existing-flow UI changes

- `ConvertModal`: each candidate prospect shows a compliance pill (`✓ Cleared` / `⚠ In review` / `✗ Blocked`); not-cleared rows disabled with a deep link to the workspace.
- `/admin/submissions/[ref]`: gains a "Compliance" panel/tab rendering the same dashboard component as the client side (component takes `parent: { type: 'prospect' | 'client', id: string }`).
- `AdminShell` left nav: new **Compliance** entry → `/admin/compliance/tasks`. Badge shows open-task count for the current user (assigned to them) + un-assigned global count.

### 7.3 Auto-wiring on ComplianceFile creation

- On submission: ComplianceFile created with one `Party(role=main_contact)` populated from the prospect's user + onboarding personal-details fields. Documents uploaded during onboarding (passport, POA) are auto-linked to that party's KycCase via their new `purpose` field.

### 7.4 Document upload from workspace

- Staff can upload docs on behalf of a party. New endpoint `POST /api/admin/compliance/parties/[id]/documents` accepts file + purpose; reuses the existing `uploadDocument` service end-to-end (AES-256-GCM encryption + activity log) — no parallel upload path.

---

## 8. Sign-off gate + flow integration

### 8.1 Lifecycle

1. **Submission accepted** → `createComplianceFile(prospectId)` creates the file + main_contact Party + KycCase + auto-links onboarding docs.
2. **Pre-conversion** — submission reviewer and compliance reviewer can work in parallel. Submission can be `approved` or `rejected` independent of compliance state.
3. **Conversion** — `convertProspectToClient` (existing service) gets the gate:
   ```
   if (submission.status !== 'approved')      throw GateError('submission_not_approved')
   if (complianceFile.status === 'blocked')   throw GateError('compliance_blocked')
   if (complianceFile.status !== 'cleared')   throw GateError('compliance_not_cleared')
   ```
   On success: Client is created; ComplianceFile gets `clientId` set; `prospectId` stays for traceability.
4. **Post-conversion** — same workspace, same file. Re-screenings + reviews + risk re-rates write back.
5. **Blocked** — Hard-block on conversion until either the blocking hit is resolved (rare) or the submission is rejected with a compliance reason.

### 8.2 Schema gates

- `ClientStatus` enum does **not** grow. Conversion is just blocked outright — fewer states, fewer edge cases than a `pending_compliance` Client.
- The existing `convertProspectToClient` signature is unchanged; only one new error variant.

### 8.3 Backfill (one-time, in worker boot, idempotent)

- Runs from `src/worker/index.ts` on every worker boot. Idempotent by query — finds only entities lacking a ComplianceFile, so re-running is safe even at scale (the query is cheap; production rows are bounded by the customer base).
- For every existing Prospect lacking a ComplianceFile → create one + main_contact Party from `prospect.user`.
- For every existing Client without one → same, plus link the Client side.
- Existing Documents are **not** auto-linked (they predate the `purpose` field). Staff link manually inside the workspace. Documented in the worker boot log and the UI.

---

## 9. API surface (summary)

All require `assertRole('staff')` (some are `staff | partner` per existing patterns; the plan will specify).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/compliance/files/[id]` | Fetch file w/ parties + tasks |
| POST | `/api/admin/compliance/files/[id]/sign-off` | Sign-off the file (note required) |
| POST | `/api/admin/compliance/files/[id]/recompute-risk` | Recompute + persist computed risk |
| PATCH | `/api/admin/compliance/files/[id]/risk` | Set/override `riskRating` (reason required when ≠ computed) |
| POST | `/api/admin/compliance/files/[id]/parties` | Add party |
| PATCH | `/api/admin/compliance/parties/[id]` | Edit party |
| DELETE | `/api/admin/compliance/parties/[id]` | Remove party (blocked if KycCase has screening history) |
| PATCH | `/api/admin/compliance/parties/[id]/kyc` | Update IDV (status, note, doc links) |
| POST | `/api/admin/compliance/parties/[id]/screen` | Run a screening |
| PATCH | `/api/admin/compliance/hits/[id]` | Set hit `reviewStatus` + note |
| POST | `/api/admin/compliance/parties/[id]/documents` | Upload doc on behalf of party |
| PATCH | `/api/admin/compliance/tasks/[id]` | Complete/dismiss a task |

---

## 10. ActivityLog actions added

Extends `ActivityAction` union in `src/lib/services/activity.ts`:

- `compliance.file_created`
- `compliance.party_added`, `compliance.party_removed`
- `compliance.idv_verified`, `compliance.idv_failed`
- `compliance.screening_run`
- `compliance.hit_reviewed`
- `compliance.risk.assessed`, `compliance.risk.overridden`
- `compliance.signed_off`, `compliance.blocked`
- `compliance.review_task_created`, `compliance.review_task_completed`

`entityType` union extended to include `'compliance_file' | 'party' | 'kyc_case' | 'screening_run' | 'review_task'`.

---

## 11. Out of scope (explicit)

These are intentionally not in this design — they belong in later sub-projects or are deferred:

- **Customer-facing compliance UX** — clients seeing their own KYC status / pending requirements. Belongs in the Client self-service portal cluster.
- **Adverse-media coverage beyond OpenSanctions topics** — would require a paid screening provider.
- **Cryptographic e-signing of sign-off** — MVP uses relational record + ActivityLog; sufficient for CySEC audit. Future ticket if regulator pushes back.
- **Per-jurisdiction risk methodology** — scoring is one global function with seeded lists. Per-country variants come later.
- **Customer messaging** for follow-up document requests — belongs in the messaging build (related to client portal cluster).
- **Notifications outside the admin UI** — email/WhatsApp for screening hits and tasks. Can layer on later via the existing `NotificationProvider`; no schema change required.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| OpenSanctions free tier rate-limits choke us at scale | Throttle + backoff in the runner (§4.4); `OPENSANCTIONS_API_KEY` env unlocks paid tier without code change |
| False positives swamp staff with `screening_hit` tasks | Dedup logic in §4.5 only creates tasks on *new* hits/topics; threshold configurable |
| Staff skips compliance review and convertor still goes through | Hard gate in `convertProspectToClient` — covered by tests |
| Backfill creates orphan ComplianceFiles for stale Prospects | Backfill is idempotent + only runs in worker boot; safe to re-run; never auto-deletes |
| `rawResponse` JSON grows the DB | Acceptable for MVP; documented; can layer compression or external archive later if needed |
| Reviewer signs off with `unreviewed` hits | Sign-off API rejects this; UI button is disabled in that state (defense in depth) |

---

## 13. Testing approach (high level — plan will expand)

- **Unit:** `computeRisk` (factor mapping, band thresholds, hard overrides); screening hit dedup; gate logic.
- **Integration:** `runScreening` against a mocked HTTP provider (record/replay style); ComplianceFile lifecycle E2E (submission → screen → review → sign-off → convert).
- **Worker:** cron job idempotency under repeated invocation.
- **Permission:** every new API enforces `assertRole('staff')`; partner & prospect attempts return 403.
