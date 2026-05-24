# Test Hardening — Design

**Date:** 2026-05-24
**Status:** Approved — ready for implementation plan
**Triggering observation:** ~25% coverage of production code paths. Pure functions + service tests with mocked Prisma exist (47 tests); zero API route / worker / E2E coverage. Several "the smoke is your job" gates in prior plans were never run. Need real integration coverage gated by CI before next feature sub-projects.

---

## 1. Purpose

Add real test coverage gated by CI so regressions stop slipping in. Specifically:

- API routes get request-level tests against a real Postgres (testcontainers).
- Worker cron jobs run end-to-end against the same.
- Critical user flows get Playwright browser E2E.
- Existing mocked-Prisma service tests migrate to real DB to catch schema drift.
- All wired into `.github/workflows/ci.yml`; coverage tracked (not gated).

---

## 2. Brainstorm decisions

| Decision | Choice | Reason |
|---|---|---|
| Integration DB | Testcontainers (real Postgres) | Same engine as prod; catches Prisma + SQL behaviour mocked DBs miss |
| Test layers | API routes + worker jobs + Playwright E2E + service-layer migration | Full pyramid; biggest leverage |
| Coverage gate | Track only | Avoid flaky "small refactor drops 0.3%" failures; tighten later |
| Auth in tests | `vi.mock("@/lib/auth")` returning a seeded session | No need to drive the cookie/JWT flow for route tests; Playwright tests use the real login UI |
| Test isolation | Per-test `$transaction` that rolls back | Fast; no truncate dance |

---

## 3. Vitest project layout

`vitest.config.ts` split into two projects:

- **`unit`** — current 47 tests (pure helpers + mocked-Prisma services). Fast. No Docker. Runs first.
- **`integration`** — new tests with real Postgres + mocked auth. Slower (testcontainer boot ~10s once per worker). Includes API route tests, worker tests, service-migration tests.

Scripts:
```json
"test": "vitest run",
"test:unit": "vitest run --project=unit",
"test:integration": "vitest run --project=integration",
"test:watch": "vitest --project=unit",
"test:coverage": "vitest run --coverage"
```

E2E lives in a separate Playwright config (`playwright.config.ts`) with `npm run test:e2e`.

---

## 4. Test infra (`src/test/*`)

### 4.1 `src/test/db.ts`

Bootstraps a Postgres testcontainer once per vitest worker, runs `prisma db push --skip-generate`, exposes `getTestPrisma()`. Container is reused across tests in the same worker; vitest's worker-per-file isolation gives us natural per-file isolation already.

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

let container: StartedPostgreSqlContainer | undefined;
let prismaClient: PrismaClient | undefined;

export async function getTestPrisma(): Promise<PrismaClient> {
  if (prismaClient) return prismaClient;
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
  prismaClient = new PrismaClient({ datasources: { db: { url } } });
  return prismaClient;
}

export async function stopTestPrisma() {
  await prismaClient?.$disconnect();
  await container?.stop();
  prismaClient = undefined;
  container = undefined;
}
```

Each test file ends with `afterAll(() => stopTestPrisma())` (or a global hook).

### 4.2 `src/test/tx.ts`

Per-test transaction wrapper:

```ts
import type { PrismaClient } from "@prisma/client";

/** Runs `fn` inside a transaction that is always rolled back, leaving the DB clean. */
export async function inRollbackTx<T>(prisma: PrismaClient, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  let result!: T;
  await prisma.$transaction(async (tx) => {
    result = await fn(tx as unknown as PrismaClient);
    throw new __Rollback();
  }).catch((e) => { if (!(e instanceof __Rollback)) throw e; });
  return result;
}
class __Rollback extends Error {}
```

### 4.3 `src/test/auth.ts`

Mocks `@/lib/auth`'s `auth()` to return a session for the duration of one test:

```ts
import { vi } from "vitest";

type TestUser = { id: string; email: string; fullName: string; role: "prospect" | "client" | "staff" | "partner" };

export function mockSession(user: TestUser | null) {
  vi.doMock("@/lib/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth")>();
    return { ...actual, auth: async () => user ? { user } : null };
  });
}

export function resetAuth() { vi.doUnmock("@/lib/auth"); }
```

### 4.4 `src/test/seed.ts`

Reusable factory helpers — `createTestUser({ role })`, `createTestProspect`, `createTestClient`, etc — each accepts the prisma client and returns the created row.

### 4.5 `src/test/route.ts`

Helper to call a route handler with a fabricated `Request`:

```ts
export function makeReq(opts: { method?: string; body?: unknown; form?: FormData; headers?: HeadersInit }) {
  const init: RequestInit = { method: opts.method ?? "GET", headers: opts.headers };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json", ...(opts.headers ?? {}) };
  } else if (opts.form) {
    init.body = opts.form;
  }
  return new Request("http://localhost/test", init);
}

export function makeParams<T>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}
```

---

## 5. API route tests

Scope: every route under `src/app/api/` that has a non-trivial handler. For each, test:

- **Unauthorised:** no session → returns 401/throws (with current `assertRole`-throws-500 pattern).
- **Wrong role:** prospect tries to access staff-only → 403/throw.
- **Validation:** invalid Zod body → 422.
- **Happy path:** valid input → 200 + persisted state.
- **Ownership:** where applicable (DocumentRequest fulfilment, message read), wrong user → 403/throw.

Test files mirror the route layout under `src/app/api/.../__tests__/route.test.ts` OR collected under `src/test/api/`. The plan will pick one convention; recommend co-located (`__tests__` next to `route.ts`).

Routes to cover (~30 files):
- `/api/auth/{register,verify,forgot,reset}/route.ts`
- `/api/account/{messages,documents,profile,password}/route.ts`
- `/api/onboarding/*/route.ts` (5 sub-routes)
- `/api/documents/{upload,[id]}/route.ts`
- `/api/admin/clients/*` (5 routes)
- `/api/admin/compliance/*` (11 routes)
- `/api/admin/settings/*` (5 routes)
- `/api/admin/submissions/*` (2 routes)
- `/api/admin/notes/route.ts`
- `/api/admin/users/[id]/verify/route.ts`

Target: ~60-80 tests in this layer.

---

## 6. Worker job tests

`src/worker/__tests__/`:

- `auto-rescreen.test.ts` — seed Client+KycCase+ScreeningRun, run `autoRescreenTick()` with mocked ScreeningProvider, assert ReviewTask created/not created per cadence + dedup.
- `periodic-review.test.ts` — seed ComplianceFile with various lastReview dates, run tick, assert tasks generated.
- `backfill-compliance.test.ts` — seed prospects+clients without ComplianceFile, run `backfillCompliance()`, assert ComplianceFile + Party + KycCase created; run again, assert idempotency (no duplicates).

Each test uses real DB (testcontainers) so cadence date math actually exercises the SQL.

Target: ~10-15 tests in this layer.

---

## 7. Playwright E2E

`playwright.config.ts` configures:
- `baseURL: http://localhost`
- One project: `chromium`
- `webServer` hook: `npm run start` against a pre-built standalone (slow first run) — or skip and assume the `docker compose` dev stack is already up (CI brings it up explicitly).

`e2e/` directory with 6 spec files (per Section 4 of the brainstorm):

1. `auth.spec.ts` — register → see verify page (or auto-verify in dev) → login → land on dashboard.
2. `onboarding-submit.spec.ts` — fill onboarding form → submit → see confirmation + reference number.
3. `convert-to-client.spec.ts` — staff approves submission → converts → client logs in → sees ClientDashboard rather than ProspectDashboard.
4. `messaging.spec.ts` — staff sends → client sees + replies → staff sees reply.
5. `doc-request.spec.ts` — staff requests doc → client uploads via FulfillButton → request flips to fulfilled.
6. `compliance-gate.spec.ts` — try to convert non-cleared prospect → conversion blocked with compliance pill visible.

Each test starts with a fresh DB state — done by hitting a small `/api/test/reset` route (only mounted when `NODE_ENV=test`) that truncates non-system tables. (Alternative: each test creates uniquely-named users; less rigorous but no test-only route.)

For dev safety: the reset route is GUARDED to return 404 unless `NODE_ENV === "test"`. Even if accidentally hit in dev, the guard rejects.

Target: ~6 specs, ~30 assertions total.

---

## 8. Service-layer migration

Existing mocked-Prisma tests stay where they are if they only verify pure logic (e.g., `risk.test.ts`, `country-risk.test.ts`, `hit-dedup.test.ts`, `industry-risk.test.ts`, `documents-bucket.test.ts`). Migrate to real DB:

- `screening.test.ts` (currently mocks Prisma + provider) → keep provider mock, switch DB to real testcontainer Prisma.
- `client-portal.test.ts` → same.

This catches schema drift (e.g., a field added in Prisma but not propagated to the mock would silently pass before, fail now).

Target: ~12 tests migrated.

---

## 9. CI changes

`.github/workflows/ci.yml`:

- Rename `validate` → `unit`. Runs `npm run test:unit` plus the existing lint + typecheck + prisma validate.
- New `integration` job: same `setup-node` + `npm ci`, then `npm run test:integration`. Testcontainers needs Docker, which `ubuntu-latest` provides natively. ~3-5 min.
- New `e2e` job: depends on `unit` + `integration`. Spins up the dev stack via `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`, waits for `/api/health`, runs `npx playwright install --with-deps chromium && npx playwright test`, tears down.
- Existing `changelog` and `build-image` jobs unchanged.
- Coverage merged from unit + integration; uploaded as a GitHub artifact (no gate).

Branch-protection rule (documented in this spec; manual GitHub UI configuration): require `unit`, `integration`, `e2e`, `changelog` to pass before merge.

---

## 10. Test-only routes & guards

One test-only route: `/api/test/reset/route.ts`. Body:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "test") return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Truncate domain tables but keep schema; bypass cascades using TRUNCATE ... CASCADE.
  const tables = ["DocumentRequest", "Message", "InternalNote", "Booking", "ReviewTask", "ScreeningHit", "ScreeningRun", "KycCase", "Party", "ComplianceFile", "Document", "KeyDate", "ClientService", "Client", "Prospect", "ActivityLog", "PasswordReset", "VerificationToken", "Session", "Account", "User", "OrgSettings", "Service", "FeatureFlag"];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  return NextResponse.json({ ok: true });
}
```

The route exists in the repo for E2E to call; the guard prevents misuse. Documented in CHANGELOG so reviewers know it's intentional.

---

## 11. Out of scope (deferred)

- **Component tests** (React Testing Library) — would need DOM env in vitest projects + Next.js component test support. Possible later.
- **Visual regression** — Percy / Chromatic / etc.
- **Load / performance** — k6 or similar.
- **Mutation testing** (Stryker).
- **Coverage gating** — once we have a baseline from this PR, raise a floor in a follow-up.
- **Property-based tests** (fast-check).
- **Internationalisation tests**.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Testcontainer boot slows CI substantially | Reuse container across tests in the same worker; cache the postgres:16-alpine image via GH Actions Docker layer cache |
| Playwright is flaky in CI | Use `--retries=2`; explicit waits via `expect(locator).toBeVisible()` not `sleep()`; capture screenshots+videos on failure as artifacts |
| Test-only `/api/test/reset` accidentally enabled in prod | Guard by `NODE_ENV === "test"`; production build sets NODE_ENV=production so route effectively 404s. Smoke test added to integration suite to verify guard. |
| Auth mock drift from real `auth()` shape | Centralised in `src/test/auth.ts`; any change to Auth.js session shape requires updating one file |
| Docker-in-Docker rate limits on GH Actions | Pin Postgres image; consider GHCR mirror later if rate-limited |
| Migration of existing tests breaks them | Migrate in their own commits one file at a time; each commit individually green before moving on |

---

## 13. Ship gate

This PR ships when:
- `npm run test:unit` green (existing 47 + any kept).
- `npm run test:integration` green (~75-95 new tests).
- `npm run test:e2e` green locally (6 specs).
- CI `unit`, `integration`, `e2e`, `changelog` jobs all green.
- `CHANGELOG.md` updated.

Coverage report shows ≥50% on `src/lib/services/**` and `src/app/api/**` (informational, not gated).

---

## 14. Estimated effort

Subagent-driven, breaking into ~15 tasks:
- Phase 1 (infra): 1 task ~10 min
- Phase 2 (API tests): 4-5 tasks ~60 min
- Phase 3 (worker tests): 1 task ~15 min
- Phase 4 (Playwright): 2 tasks ~40 min
- Phase 5 (service migration): 1 task ~15 min
- Phase 6 (CI + smoke): 1 task ~15 min

Real elapsed time depends on review loops and CI iteration.
