# Bucket A — UI Polish + Bug Fixes (for PR #4)

**Date:** 2026-05-24
**Status:** Approved — ready for implementation plan
**Context:** Final-review of the test-hardening PR (#4) surfaced two real bugs. A separate UI audit of merged work (PR #1-3) found 8 small gaps where features exist in services/schema but lack adequate UI surfacing. This spec batches those small items onto PR #4 before merge.

---

## 1. Items

### 1.1 Hit-review status badge on file dashboard (#2)

**Where:** `src/components/compliance/ComplianceDashboard.tsx` — parties table.
**What:** Each party row currently shows `KycCase.state` + latest screening outcome. Add a per-row pill showing **unreviewed hit count** sourced from the party's latest `ScreeningRun`. When `unreviewedHits > 0`, the pill is red and reads `N to review`. When zero hits exist, omit the pill. Click navigates to the party workspace.

### 1.2 "Last screened / next due" indicator per KycCase (#3)

**Where:** Same parties table; new column or inline metadata under the screening outcome.
**What:** For each party with a `latestScreeningRun`, show `last X ago` (relative date) + `next: Yd` based on the cadence map (`high=30d, standard=90d, low=365d`). When `now > nextDue`, render in red as `overdue`. Pure derived data; no schema change.

### 1.3 Doc purpose selector on admin upload (#5)

**Where:** `src/app/admin/clients/[id]/UploadButton.tsx` — currently uses `defaultPurpose` per folder.
**What:** Replace the silent default with a small dropdown that shows above the file picker: `passport`, `proof_of_address`, `source_of_funds`, `other`. Pre-selected to the folder's natural purpose (KYC folder → passport, Correspondence → other). API contract already supports it (Task 11 of the client-page PR added `purpose: DocPurpose` to `uploadDocument`).

### 1.4 "Cannot delete uploaded docs" note in client portal (#6)

**Where:** `src/app/app/documents/page.tsx` — top of the section.
**What:** One sentence under the heading: *"Documents you upload are kept for audit. Contact your account manager if a document needs to be removed."* Pure copy; no logic.

### 1.5 Edit a DocumentRequest before fulfilment (#7)

**Where:** `src/app/admin/clients/[id]/request-docs/page.tsx` — history list, each open row.
**What:** Add an "Edit" button per open request that opens a small modal pre-filled with `description` + `dueAt`. Save calls `PATCH /api/admin/document-requests/[id]` with the new values. The route currently only accepts `{state: "cancelled"}` — extend its Zod schema to also accept `description?: string` and `dueAt?: string|null`. Both fields nullable/optional; cancellation still works.

### 1.6 Risk-override history block on compliance dashboard (#9)

**Where:** `src/components/compliance/RiskPanel.tsx` — extend.
**What:** Below the current rating + override form, render a chronological list of past risk-overrides for this ComplianceFile. Source: `ActivityLog` rows where `entityId = complianceFile.id AND action = "compliance.risk_overridden"`, ordered desc, limit 10. For each: timestamp, actor name, `before → after`, reason, escalated flag. Pure read; no schema or API change.

### 1.7 assign-partner role check + UI audit (#10)

**Bug fix (PR #4 surfaced):** `src/app/api/admin/submissions/[id]/assign-partner/route.ts` accepts any user UUID. Add: look up the target user; if `role !== "partner"`, return `400 { error: "Target is not a partner" }`. Add a test asserting the rejection.

**UI audit:** confirm there's a way to assign a partner from `/admin/submissions/[ref]` or `/admin/clients/[id]`. If a button exists but is hidden/broken, surface it visibly. If no button at all, add one to the submission detail page sidebar that opens a partner-picker modal.

### 1.8 auto-rescreen 365d filter bug (PR #4 surfaced)

**Bug fix:** `src/worker/jobs/auto-rescreen.ts` line ~16 — the outer `findMany` filter `latestScreeningRun: { ranAt: { lt: cutoff(365) } }` excludes high/standard-risk cases whose latest run is younger than 365d but older than their band cadence (30d/90d). Replace the outer cutoff with the **shortest** cadence (30d) so the per-case `cutoffForBand` check downstream can correctly filter. The change: `lt: cutoff(365)` → `lt: cutoff(30)`. Add a test asserting that a standard-band case with a 100-day-old run gets picked up.

---

## 2. API changes

- `PATCH /api/admin/document-requests/[id]` — Zod schema extended to also accept `description?: string.min(3).max(500)` and `dueAt?: string.date().nullable()`. Existing service `cancelDocumentRequest` only handles `cancelled`; add a sibling `updateDocumentRequest(id, patch, actorId)` in `src/lib/services/document-requests.ts` that updates description/dueAt with an activity-log entry (new action: `doc_request.updated`).

## 3. Schema / service additions

- `ActivityAction` union gains `"doc_request.updated"`. No other schema change.
- New service function: `updateDocumentRequest(requestId, patch: { description?, dueAt? }, actorId)`.

## 4. Component changes

| Component | Change |
|---|---|
| `ComplianceDashboard.tsx` | Add unreviewed-hits pill per party + last-screened/next-due metadata |
| `RiskPanel.tsx` | Append `RiskOverrideHistory` block reading from ActivityLog |
| `UploadButton.tsx` | Add purpose `<select>` |
| `DocumentRow.tsx` (admin) | Unchanged |
| `RequestForm.tsx` (admin /request-docs) | Reuse for the edit modal (rename slightly: `RequestForm` becomes parameterised by an optional `initial` prop) OR add a new `EditRequestButton` client component |
| `/app/documents/page.tsx` (client) | Add the no-delete sentence under the heading |

## 5. Tests required

Per the changelog gate + the test-hardening PR's coverage philosophy, every API change ships with tests.

- `PATCH /api/admin/document-requests/[id]` test gains 2 cases: update description+dueAt; update + cancel in one call rejected (or accepted, decide in plan).
- `assign-partner` role-check test (the existing concern-only test gets a real assertion).
- `auto-rescreen` test gets a new case for standard-risk overdue at 100 days.
- Component tests — not adding (we don't have RTL set up; visual tweaks rely on Playwright + spot-check).
- CHANGELOG entries for each item.

## 6. Out of scope (deferred)

Bucket B items (compliance activity timeline, worker job health page, staff-initiated booking, edit/cancel messages) — separate sub-projects.

## 7. Acceptance criteria

PR #4 ships when:
- All 8 items implemented + visible in the dev stack.
- The 2 bug fixes have regression tests.
- `npm run test:unit && npm run test:integration` green.
- Playwright E2E (8 specs) green.
- CHANGELOG updated.
