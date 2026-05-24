# KYC / AML Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the KYC/AML compliance subsystem (ComplianceFile + parties + KYC + OpenSanctions screening + risk + worker monitoring + admin UI + conversion gate) to the ORO fiduciary platform per `docs/superpowers/specs/2026-05-24-kyc-aml-compliance-design.md`.

**Architecture:** ComplianceFile aggregate (one per Prospect/Client). Parties (UBO/director/etc.) hang off it, each with a KycCase. Staff-only IDV. OpenSanctions for screening. Rules-based risk score + staff override. Worker cron re-screens and creates review tasks on a risk-band cadence. Conversion blocked until ComplianceFile is `cleared`.

**Tech Stack:** Next.js 15 App Router, Prisma + Postgres, Auth.js v5, Tailwind, node-cron worker, Vitest (added in Task 1) for unit + integration tests.

---

## Conventions used throughout

- **TDD** for pure functions and services with deterministic inputs (risk scoring, hit dedup, ComplianceFile service logic). UI and API routes get implemented then smoke-tested manually via `curl` + browser per the final task.
- **Commits** after every passing test or coherent UI chunk. Conventional commit prefixes (`feat:`, `test:`, `chore:`, `refactor:`).
- **All file paths absolute from repo root.**
- **Existing patterns to follow:**
  - Server-side guards: `assertRole('staff')` from `src/lib/auth/guards.ts` for API routes; `requireRole('staff')` for pages.
  - Activity logging: `logActivity({ entityType, entityId, action, actorId, meta })` from `src/lib/services/activity.ts`.
  - Provider pattern: see `src/lib/providers/storage.ts` / `src/lib/providers/email.ts` for the shape (interface + concrete impls + factory function that reads env).
  - Existing Prisma client: `import { prisma } from '@/lib/db'`.
- **Dev hot reload:** the running web container picks up file changes via `next dev`. Schema changes require `prisma db push` in the container + a `docker compose restart web` so `@prisma/client` reloads.

---

## Phase 1 — Foundation (testing + schema)

### Task 1: Add Vitest and one passing smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json` (add deps + scripts)

- [ ] **Step 1: Install Vitest + companions**

Run:
```bash
npm install --save-dev vitest @vitest/coverage-v8 vite-tsconfig-paths
```

Expected: 3 packages added, `package-lock.json` updated. No peer-dep warnings.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/services/compliance/**", "src/lib/providers/screening*.ts"],
    },
  },
});
```

- [ ] **Step 3: Add scripts to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Write the smoke test**

`src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed, 1 total.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__tests__/smoke.test.ts
git commit -m "chore: add vitest with smoke test"
```

---

### Task 2: Extend Prisma schema with compliance models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append compliance enums to `prisma/schema.prisma`**

Insert just after the existing `enum BookingStatus { ... }` block (around line 68):

```prisma
enum ComplianceStatus {
  open
  in_review
  cleared
  blocked
}

enum RiskRating {
  low
  standard
  high
}

enum PartyType {
  individual
  entity
}

enum PartyRole {
  main_contact
  ubo
  director
  shareholder
  signatory
  intermediary
}

enum KycCheckStatus {
  pending
  verified
  failed
}

enum KycCaseState {
  pending
  in_progress
  passed
  blocked
}

enum ScreeningOutcome {
  clear
  hits
  error
}

enum HitReviewStatus {
  unreviewed
  false_positive
  confirmed_match
  escalated
}

enum ReviewTaskKind {
  periodic_review
  screening_hit
  id_doc_review
  risk_assessment
}

enum ReviewTaskState {
  open
  completed
  dismissed
}

enum DocPurpose {
  passport
  proof_of_address
  sof
  other
}
```

- [ ] **Step 2: Extend `Document` model**

Find the existing `model Document { ... }` block (~line 134). Add these fields just before the trailing index lines:

```prisma
  partyId      String?
  party        Party?    @relation(fields: [partyId], references: [id])
  purpose      DocPurpose @default(other)
```

The index block should now also include `@@index([partyId])` alongside the existing `@@index([prospectId])`.

- [ ] **Step 3: Extend `User` model with compliance back-relations**

Find `model User { ... }` (~line 70). Add these inside the relation block (anywhere after `accounts`):

```prisma
  // Compliance back-relations
  complianceSignOffs   ComplianceFile[] @relation("ComplianceSigner")
  riskAssessments      ComplianceFile[] @relation("RiskAssessor")
  idvReviews           KycCase[]        @relation("IdvReviewer")
  screeningRuns        ScreeningRun[]   @relation("ScreeningRunner")
  hitReviews           ScreeningHit[]   @relation("HitReviewer")
  reviewTaskAssignments ReviewTask[]    @relation("ReviewAssignee")
```

- [ ] **Step 4: Append the new models at end of `prisma/schema.prisma`**

```prisma
// --- Compliance (KYC/AML) -----------------------------------------------

model ComplianceFile {
  id                  String   @id @default(uuid())
  prospectId          String?  @unique
  prospect            Prospect? @relation(fields: [prospectId], references: [id])
  clientId            String?  @unique
  client              Client?  @relation(fields: [clientId], references: [id])

  status              ComplianceStatus @default(open)

  signedOffById       String?
  signedOff           User?    @relation("ComplianceSigner", fields: [signedOffById], references: [id])
  signedOffAt         DateTime?
  signedOffNote       String?

  riskComputed        RiskRating?
  riskComputedScore   Int?
  riskRating          RiskRating?
  riskOverrideReason  String?
  riskAssessedAt      DateTime?
  riskAssessedById    String?
  riskAssessedBy      User?    @relation("RiskAssessor", fields: [riskAssessedById], references: [id])

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  parties             Party[]
  reviewTasks         ReviewTask[]

  @@index([status])
}

model Party {
  id                  String   @id @default(uuid())
  complianceFileId    String
  complianceFile      ComplianceFile @relation(fields: [complianceFileId], references: [id], onDelete: Cascade)

  type                PartyType
  role                PartyRole
  fullName            String
  dateOfBirth         DateTime?
  nationality         String?
  countryOfResidence  String?
  passportNumber      String?
  registrationNumber  String?
  jurisdiction        String?
  ownershipPct        Decimal? @db.Decimal(5, 2)
  isPep               Boolean  @default(false)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  kycCase             KycCase?
  documents           Document[]

  @@index([complianceFileId])
}

model KycCase {
  id                    String   @id @default(uuid())
  partyId               String   @unique
  party                 Party    @relation(fields: [partyId], references: [id], onDelete: Cascade)

  idvStatus             KycCheckStatus @default(pending)
  idvReviewedById       String?
  idvReviewedBy         User?    @relation("IdvReviewer", fields: [idvReviewedById], references: [id])
  idvReviewedAt         DateTime?
  idvNote               String?

  passportDocId         String?
  proofOfAddressDocId   String?
  sofDocId              String?
  sofNote               String?

  latestScreeningRunId  String?
  latestScreeningRun    ScreeningRun? @relation("LatestScreening", fields: [latestScreeningRunId], references: [id])

  state                 KycCaseState @default(pending)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  screeningRuns         ScreeningRun[]  @relation("CaseRuns")

  @@index([state])
}

model ScreeningRun {
  id              String   @id @default(uuid())
  kycCaseId       String
  kycCase         KycCase  @relation("CaseRuns", fields: [kycCaseId], references: [id], onDelete: Cascade)

  provider        String
  query           Json
  ranAt           DateTime @default(now())
  ranByActorId    String?
  ranByActor      User?    @relation("ScreeningRunner", fields: [ranByActorId], references: [id])
  outcome         ScreeningOutcome
  hitCount        Int      @default(0)
  rawResponse     Json?
  errorMessage    String?

  hits            ScreeningHit[]
  latestForCase   KycCase[] @relation("LatestScreening")

  @@index([kycCaseId, ranAt])
}

model ScreeningHit {
  id              String   @id @default(uuid())
  screeningRunId  String
  screeningRun    ScreeningRun @relation(fields: [screeningRunId], references: [id], onDelete: Cascade)

  externalId      String
  matchedName     String
  matchedSchema   String
  matchedTopics   String[]
  matchScore      Float
  matchedListings Json
  matchUrl        String?

  reviewStatus    HitReviewStatus @default(unreviewed)
  reviewedById    String?
  reviewedBy      User?    @relation("HitReviewer", fields: [reviewedById], references: [id])
  reviewedAt      DateTime?
  reviewNote      String?

  @@index([screeningRunId])
  @@index([externalId])
}

model ReviewTask {
  id                String   @id @default(uuid())
  complianceFileId  String
  complianceFile    ComplianceFile @relation(fields: [complianceFileId], references: [id], onDelete: Cascade)

  kind              ReviewTaskKind
  dueAt             DateTime?
  state             ReviewTaskState @default(open)
  assignedToId      String?
  assignedTo        User?    @relation("ReviewAssignee", fields: [assignedToId], references: [id])
  note              String?
  completedAt       DateTime?

  createdAt         DateTime @default(now())

  @@index([complianceFileId, state])
  @@index([assignedToId, state])
}
```

- [ ] **Step 5: Add inverse relation accessors on `Prospect` and `Client`**

Find `model Prospect { ... }` and add inside the relations block:

```prisma
  complianceFile ComplianceFile?
```

Find `model Client { ... }` and add inside the relations block:

```prisma
  complianceFile ComplianceFile?
```

- [ ] **Step 6: Push schema, regenerate client, restart web**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web \
  node ./node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --accept-data-loss
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart web
```

Expected: "in sync" or migration applied. Web back up in <10s. `until curl -fsS http://localhost/api/health > /dev/null; do sleep 1; done` returns quickly.

- [ ] **Step 7: Verify the new models are queryable**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web node -e \
  "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.complianceFile.count().then(c=>console.log('count:',c)).finally(()=>p.\$disconnect());"
```

Expected: `count: 0`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add KYC/AML compliance models"
```

---

## Phase 2 — Pure functions (TDD)

### Task 3: Country-risk lookup

**Files:**
- Create: `src/lib/services/compliance/data/country-risk.ts`
- Create: `src/lib/services/compliance/__tests__/country-risk.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/services/compliance/__tests__/country-risk.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { countryRisk } from "../data/country-risk";

describe("countryRisk", () => {
  it("returns 0 for low-risk (CY)", () => {
    expect(countryRisk("CY")).toBe(0);
  });
  it("returns 3 for FATF-blacklisted (KP)", () => {
    expect(countryRisk("KP")).toBe(3);
  });
  it("returns 3 for IR (Iran)", () => {
    expect(countryRisk("IR")).toBe(3);
  });
  it("defaults to 1 for unknown codes", () => {
    expect(countryRisk("ZZ")).toBe(1);
  });
  it("is case-insensitive", () => {
    expect(countryRisk("kp")).toBe(3);
  });
  it("returns 0 for null/empty input", () => {
    expect(countryRisk(null)).toBe(0);
    expect(countryRisk("")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `npx vitest run src/lib/services/compliance/__tests__/country-risk.test.ts`
Expected: FAIL — `Cannot find module '../data/country-risk'`.

- [ ] **Step 3: Implement**

`src/lib/services/compliance/data/country-risk.ts`:
```ts
/**
 * Per-country risk score (0 = low, 3 = FATF blacklisted / prohibited).
 * Sources: FATF high-risk + jurisdictions under monitoring; EU AMLD5 high-risk
 * third-country list. Reviewed annually — update both lists below in tandem.
 */
const FATF_BLACKLIST = ["KP", "IR", "MM"];
const FATF_GREYLIST = [
  "AF", "AL", "BB", "BF", "KH", "KY", "CD", "GI", "HT", "JM",
  "JO", "ML", "MZ", "NI", "PA", "PH", "SN", "SS", "SY", "TR",
  "UG", "AE", "YE",
];
// Common offshore / lower-transparency jurisdictions kept at "medium" (2)
// pending a fuller methodology.
const ELEVATED = ["BS", "BZ", "VG", "MH", "VU", "SC"];

export function countryRisk(code: string | null | undefined): 0 | 1 | 2 | 3 {
  if (!code) return 0;
  const c = code.trim().toUpperCase();
  if (FATF_BLACKLIST.includes(c)) return 3;
  if (FATF_GREYLIST.includes(c)) return 2;
  if (ELEVATED.includes(c)) return 2;
  // EU + EFTA + UK + AU/CA/NZ/JP/SG/HK/US as "low"
  const LOW = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    "IS", "LI", "NO", "CH",
    "GB", "US", "CA", "AU", "NZ", "JP", "SG", "HK", "IL",
  ];
  if (LOW.includes(c)) return 0;
  return 1;
}

export const FATF_BLACKLISTED = new Set(FATF_BLACKLIST);
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/services/compliance/__tests__/country-risk.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/compliance/data/country-risk.ts src/lib/services/compliance/__tests__/country-risk.test.ts
git commit -m "feat(compliance): add country-risk lookup table"
```

---

### Task 4: Industry-risk lookup

**Files:**
- Create: `src/lib/services/compliance/data/industry-risk.ts`
- Create: `src/lib/services/compliance/__tests__/industry-risk.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { industryRisk } from "../data/industry-risk";

describe("industryRisk", () => {
  it("returns 3 for gambling keywords", () => {
    expect(industryRisk("Online casino & sportsbook operator")).toBe(3);
  });
  it("returns 3 for crypto/digital-asset keywords", () => {
    expect(industryRisk("Crypto exchange and OTC trading desk")).toBe(3);
  });
  it("returns 3 for arms keywords", () => {
    expect(industryRisk("Defense and weapons procurement consultancy")).toBe(3);
  });
  it("returns 2 for real-estate / precious-metals", () => {
    expect(industryRisk("Real estate brokerage")).toBe(2);
    expect(industryRisk("Precious metals trading")).toBe(2);
  });
  it("returns 1 for cash-intensive (restaurant / car wash)", () => {
    expect(industryRisk("Restaurant operator")).toBe(1);
  });
  it("returns 0 for default professional services", () => {
    expect(industryRisk("Software consultancy")).toBe(0);
  });
  it("handles empty input", () => {
    expect(industryRisk("")).toBe(0);
    expect(industryRisk(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

Run: `npx vitest run src/lib/services/compliance/__tests__/industry-risk.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement**

`src/lib/services/compliance/data/industry-risk.ts`:
```ts
/**
 * Industry risk classification based on FATF + Cyprus AML guidance.
 * Matches by case-insensitive substring against the business-activity free text.
 * Higher-risk keywords win.
 */
const TIERS: { score: 0 | 1 | 2 | 3; keywords: string[] }[] = [
  { score: 3, keywords: ["gambling", "casino", "sportsbook", "betting", "crypto", "digital asset", "virtual asset", "vasp", "arms", "weapons", "defense", "defence", "munitions"] },
  { score: 2, keywords: ["real estate", "precious metals", "diamond", "jewellery", "jewelry", "art dealer", "auction", "money service", "msb", "remittance"] },
  { score: 1, keywords: ["restaurant", "bar ", "nightclub", "car wash", "laundromat", "convenience store", "scrap metal", "second-hand goods"] },
];

export function industryRisk(activity: string | null | undefined): 0 | 1 | 2 | 3 {
  if (!activity) return 0;
  const hay = activity.toLowerCase();
  for (const tier of TIERS) {
    if (tier.keywords.some((kw) => hay.includes(kw))) return tier.score;
  }
  return 0;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/services/compliance/__tests__/industry-risk.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/compliance/data/industry-risk.ts src/lib/services/compliance/__tests__/industry-risk.test.ts
git commit -m "feat(compliance): add industry-risk lookup"
```

---

### Task 5: `computeRisk` pure function

**Files:**
- Create: `src/lib/services/compliance/risk.ts`
- Create: `src/lib/services/compliance/__tests__/risk.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeRisk, type RiskInput } from "../risk";

function makeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    parties: [],
    expectedTurnover: "<50K",
    businessActivity: "Software consultancy",
    hasNominees: false,
    entityLayers: 1,
    ...overrides,
  };
}

describe("computeRisk", () => {
  it("scores low for clean Cyprus individual", () => {
    const r = computeRisk(makeInput({
      parties: [{ role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null }],
    }));
    expect(r.rating).toBe("low");
    expect(r.score).toBe(0);
  });

  it("forces high when any party in FATF blacklist", () => {
    const r = computeRisk(makeInput({
      parties: [
        { role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null },
        { role: "ubo",          isPep: false, nationality: "KP", countryOfResidence: "CY", jurisdiction: null },
      ],
    }));
    expect(r.rating).toBe("high");
    expect(r.factors.forcedHigh).toBe(true);
  });

  it("bumps PEP score when main contact is PEP", () => {
    const r = computeRisk(makeInput({
      parties: [{ role: "main_contact", isPep: true, nationality: "CY", countryOfResidence: "CY", jurisdiction: null }],
    }));
    expect(r.factors.pep).toBe(3);
  });

  it("standard band for greylisted-country UBO + low turnover", () => {
    const r = computeRisk(makeInput({
      parties: [
        { role: "main_contact", isPep: false, nationality: "GB", countryOfResidence: "GB", jurisdiction: null },
        { role: "ubo",          isPep: false, nationality: "AE", countryOfResidence: "AE", jurisdiction: null },
      ],
      expectedTurnover: "200K-500K",
    }));
    expect(r.rating).toBe("standard");
    expect(r.factors.geo).toBeGreaterThanOrEqual(2);
  });

  it("high band for crypto + 1M+ turnover", () => {
    const r = computeRisk(makeInput({
      parties: [{ role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null }],
      businessActivity: "Cryptocurrency exchange",
      expectedTurnover: "1M+",
    }));
    expect(r.rating).toBe("high");
    expect(r.factors.industry).toBe(3);
    expect(r.factors.turnover).toBe(3);
  });

  it("nominees + many parties push complexity", () => {
    const parties = Array.from({ length: 6 }, () => ({
      role: "ubo" as const, isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null,
    }));
    parties.unshift({ role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null });
    const r = computeRisk(makeInput({ parties, hasNominees: true, entityLayers: 3 }));
    expect(r.factors.complexity).toBe(3);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

- [ ] **Step 3: Implement**

`src/lib/services/compliance/risk.ts`:
```ts
import { countryRisk, FATF_BLACKLISTED } from "./data/country-risk";
import { industryRisk } from "./data/industry-risk";

export type RiskRatingLabel = "low" | "standard" | "high";

export interface PartyInput {
  role: "main_contact" | "ubo" | "director" | "shareholder" | "signatory" | "intermediary";
  isPep: boolean;
  nationality: string | null;
  countryOfResidence: string | null;
  jurisdiction: string | null;
}

export interface RiskInput {
  parties: PartyInput[];
  expectedTurnover: "<50K" | "50K-200K" | "200K-500K" | "500K-1M" | "1M+";
  businessActivity: string | null;
  hasNominees: boolean;
  entityLayers: number;
}

export interface RiskFactors {
  geo: 0 | 1 | 2 | 3;
  pep: 0 | 1 | 2 | 3;
  industry: 0 | 1 | 2 | 3;
  complexity: 0 | 1 | 2 | 3;
  turnover: 0 | 1 | 2 | 3;
  forcedHigh: boolean;
}

export interface RiskResult {
  score: number;
  rating: RiskRatingLabel;
  factors: RiskFactors;
}

const TURNOVER: Record<RiskInput["expectedTurnover"], 0 | 1 | 2 | 3> = {
  "<50K":      0,
  "50K-200K":  1,
  "200K-500K": 1,
  "500K-1M":   2,
  "1M+":       3,
};

export function computeRisk(input: RiskInput): RiskResult {
  const geoCandidates = input.parties.flatMap((p) =>
    [p.nationality, p.countryOfResidence, p.jurisdiction].map(countryRisk),
  );
  const geo = (geoCandidates.length ? Math.max(...geoCandidates) : 0) as 0 | 1 | 2 | 3;

  const forcedHigh = input.parties.some((p) =>
    [p.nationality, p.countryOfResidence, p.jurisdiction]
      .filter(Boolean)
      .some((code) => FATF_BLACKLISTED.has(String(code).toUpperCase())),
  );

  const anyPep = input.parties.some((p) => p.isPep);
  const mainPep = input.parties.some((p) => p.role === "main_contact" && p.isPep);
  const pep: 0 | 1 | 2 | 3 = mainPep ? 3 : anyPep ? 2 : 0;

  const industry = industryRisk(input.businessActivity);

  let complexity: 0 | 1 | 2 | 3 = 0;
  if (input.parties.length > 5) complexity = 2;
  else if (input.parties.length > 2) complexity = 1;
  if (input.hasNominees) complexity = Math.min(3, complexity + 1) as 0 | 1 | 2 | 3;
  if (input.entityLayers >= 3) complexity = 3;

  const turnover = TURNOVER[input.expectedTurnover];

  const score = geo + pep + industry + complexity + turnover;
  let rating: RiskRatingLabel = score <= 3 ? "low" : score <= 7 ? "standard" : "high";
  if (forcedHigh) rating = "high";

  return { score, rating, factors: { geo, pep, industry, complexity, turnover, forcedHigh } };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/services/compliance/__tests__/risk.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/compliance/risk.ts src/lib/services/compliance/__tests__/risk.test.ts
git commit -m "feat(compliance): add computeRisk scoring function"
```

---

### Task 6: Hit dedup helper

**Files:**
- Create: `src/lib/services/compliance/hit-dedup.ts`
- Create: `src/lib/services/compliance/__tests__/hit-dedup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { diffHitsForAlert, type HitSummary } from "../hit-dedup";

const h = (externalId: string, topics: string[]): HitSummary => ({ externalId, topics });

describe("diffHitsForAlert", () => {
  it("no previous run -> alerts if any current hit", () => {
    expect(diffHitsForAlert(null, [h("A", ["sanction"])])).toBe(true);
    expect(diffHitsForAlert(null, [])).toBe(false);
  });
  it("alerts on a new externalId", () => {
    expect(diffHitsForAlert([h("A", ["role.pep"])], [h("A", ["role.pep"]), h("B", ["sanction"])])).toBe(true);
  });
  it("alerts on a new topic for an existing externalId", () => {
    expect(diffHitsForAlert([h("A", ["role.pep"])], [h("A", ["role.pep", "sanction"])])).toBe(true);
  });
  it("does NOT alert when current is subset of previous", () => {
    expect(diffHitsForAlert([h("A", ["role.pep", "sanction"])], [h("A", ["role.pep"])])).toBe(false);
  });
  it("does NOT alert when identical", () => {
    expect(diffHitsForAlert([h("A", ["role.pep"]), h("B", [])], [h("A", ["role.pep"]), h("B", [])])).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

- [ ] **Step 3: Implement**

`src/lib/services/compliance/hit-dedup.ts`:
```ts
export interface HitSummary {
  externalId: string;
  topics: string[];
}

/** Returns true if the current run contains a hit (or topic) not seen in the
 *  previous run. Drives whether ongoing monitoring opens a ReviewTask. */
export function diffHitsForAlert(previous: HitSummary[] | null, current: HitSummary[]): boolean {
  if (!previous) return current.length > 0;
  const prev = new Map(previous.map((h) => [h.externalId, new Set(h.topics)]));
  for (const cur of current) {
    const prevTopics = prev.get(cur.externalId);
    if (!prevTopics) return true;
    for (const t of cur.topics) {
      if (!prevTopics.has(t)) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/services/compliance/__tests__/hit-dedup.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/compliance/hit-dedup.ts src/lib/services/compliance/__tests__/hit-dedup.test.ts
git commit -m "feat(compliance): add hit-dedup helper"
```

---

## Phase 3 — OpenSanctions provider

### Task 7: `ScreeningProvider` interface + factory

**Files:**
- Create: `src/lib/providers/screening.ts`
- Modify: `src/lib/env.ts` (add `SCREENING_DRIVER`, `SCREENING_MATCH_THRESHOLD`, `OPENSANCTIONS_API_KEY`)

- [ ] **Step 1: Extend env schema**

Open `src/lib/env.ts`. In the Zod schema (after the `Email` block, before `OAuth`), add:
```ts
  // Compliance screening
  SCREENING_DRIVER: z.enum(["opensanctions"]).default("opensanctions"),
  SCREENING_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  OPENSANCTIONS_API_KEY: z.string().optional(),
```

- [ ] **Step 2: Create the provider interface**

`src/lib/providers/screening.ts`:
```ts
import { env } from "@/lib/env";

export type ScreeningSchema = "Person" | "Organization";

export interface ScreeningQuery {
  schema: ScreeningSchema;
  name: string;
  birthDate?: string;        // ISO YYYY-MM-DD
  nationality?: string;      // ISO 3166-1 alpha-2
  jurisdiction?: string;     // for entities
  registrationNumber?: string;
}

export interface ProviderHit {
  externalId: string;
  matchedName: string;
  matchedSchema: string;
  matchedTopics: string[];
  matchScore: number;
  matchedListings: unknown;
  matchUrl?: string;
}

export interface ScreeningResult {
  outcome: "clear" | "hits" | "error";
  hits: ProviderHit[];
  raw?: unknown;
  errorMessage?: string;
}

export interface ScreeningProvider {
  readonly name: string;
  match(input: ScreeningQuery): Promise<ScreeningResult>;
}

let cached: ScreeningProvider | undefined;

export function screening(): ScreeningProvider {
  if (cached) return cached;
  const driver = env().SCREENING_DRIVER;
  switch (driver) {
    case "opensanctions": {
      // Lazy import so tests can mock without pulling network code.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OpenSanctionsProvider } = require("./screening.opensanctions");
      cached = new OpenSanctionsProvider({
        apiKey: env().OPENSANCTIONS_API_KEY,
        threshold: env().SCREENING_MATCH_THRESHOLD,
      });
      return cached!;
    }
  }
}

/** Test-only: override the provider for the duration of a test. */
export function __setScreeningProviderForTests(p: ScreeningProvider | undefined) {
  cached = p;
}
```

- [ ] **Step 3: Commit (interface only, no impl yet — type-check)**

```bash
npm run typecheck   # ensure provider file compiles
git add src/lib/providers/screening.ts src/lib/env.ts
git commit -m "feat(screening): add ScreeningProvider interface + env wiring"
```

> Note: `npm run typecheck` will warn about the unresolved require until Task 8. Expected. If TypeScript blocks the commit (it shouldn't — `require` is fine), proceed to Task 8 and commit them together.

---

### Task 8: `OpenSanctionsProvider` implementation

**Files:**
- Create: `src/lib/providers/screening.opensanctions.ts`
- Create: `src/lib/providers/__tests__/screening.opensanctions.test.ts`

- [ ] **Step 1: Write the failing test (fetch is mocked)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenSanctionsProvider } from "../screening.opensanctions";

const ok = (json: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) } as Response);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("OpenSanctionsProvider", () => {
  it("returns 'clear' when API returns no results above threshold", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() =>
      ok({ responses: { q1: { results: [] } } }),
    );
    const p = new OpenSanctionsProvider({ threshold: 0.7 });
    const r = await p.match({ schema: "Person", name: "Jane Smith" });
    expect(r.outcome).toBe("clear");
    expect(r.hits).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("filters by threshold and returns hits", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      ok({
        responses: {
          q1: {
            results: [
              { id: "NK-100", score: 0.9, caption: "John Doe", schema: "Person", properties: { topics: ["sanction"] }, datasets: ["us_ofac_sdn"] },
              { id: "NK-101", score: 0.5, caption: "Jonny D",  schema: "Person", properties: { topics: ["role.pep"] }, datasets: [] },
            ],
          },
        },
      }),
    );
    const p = new OpenSanctionsProvider({ threshold: 0.7 });
    const r = await p.match({ schema: "Person", name: "John Doe" });
    expect(r.outcome).toBe("hits");
    expect(r.hits.map((h) => h.externalId)).toEqual(["NK-100"]);
    expect(r.hits[0].matchedTopics).toEqual(["sanction"]);
  });

  it("retries on 429 then succeeds", async () => {
    let calls = 0;
    vi.spyOn(global, "fetch").mockImplementation(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ ok: false, status: 429 } as Response);
      return ok({ responses: { q1: { results: [] } } });
    });
    const p = new OpenSanctionsProvider({ threshold: 0.7, retryDelayMs: 1 });
    const r = await p.match({ schema: "Person", name: "Anyone" });
    expect(r.outcome).toBe("clear");
    expect(calls).toBe(2);
  });

  it("returns 'error' after exhausting retries", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 500 } as Response);
    const p = new OpenSanctionsProvider({ threshold: 0.7, retryDelayMs: 1 });
    const r = await p.match({ schema: "Person", name: "X" });
    expect(r.outcome).toBe("error");
    expect(r.errorMessage).toMatch(/500/);
  });

  it("sends API key header when configured", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() =>
      ok({ responses: { q1: { results: [] } } }),
    );
    const p = new OpenSanctionsProvider({ threshold: 0.7, apiKey: "secret123" });
    await p.match({ schema: "Person", name: "X" });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("ApiKey secret123");
  });
});
```

- [ ] **Step 2: Run, confirm fails**

Run: `npx vitest run src/lib/providers/__tests__/screening.opensanctions.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement**

`src/lib/providers/screening.opensanctions.ts`:
```ts
import type { ScreeningProvider, ScreeningQuery, ScreeningResult, ProviderHit } from "./screening";

interface Opts {
  apiKey?: string;
  threshold: number;
  endpoint?: string;      // override for tests
  retryDelayMs?: number;  // base for backoff
}

const DEFAULT_ENDPOINT = "https://api.opensanctions.org/match/default";
const MAX_RETRIES = 3;

export class OpenSanctionsProvider implements ScreeningProvider {
  readonly name = "opensanctions";
  private readonly endpoint: string;
  private readonly retryDelayMs: number;

  constructor(private readonly opts: Opts) {
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.retryDelayMs = opts.retryDelayMs ?? 250;
  }

  async match(input: ScreeningQuery): Promise<ScreeningResult> {
    const body = {
      queries: {
        q1: {
          schema: input.schema,
          properties: this.toProperties(input),
        },
      },
    };

    let lastErr = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.opts.apiKey ? { Authorization: `ApiKey ${this.opts.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
        });
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        await wait(this.retryDelayMs * 2 ** attempt);
        continue;
      }
      if (res.ok) {
        const json = (await res.json()) as { responses: Record<string, { results: RawResult[] }> };
        const results = json.responses?.q1?.results ?? [];
        const hits = results
          .filter((r) => (r.score ?? 0) >= this.opts.threshold)
          .map(this.toHit);
        return {
          outcome: hits.length > 0 ? "hits" : "clear",
          hits,
          raw: json,
        };
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        await wait(this.retryDelayMs * 2 ** attempt);
        continue;
      }
      // 4xx other than 429 = unrecoverable
      const errBody = await safeText(res);
      return { outcome: "error", hits: [], errorMessage: `HTTP ${res.status}: ${errBody}` };
    }
    return { outcome: "error", hits: [], errorMessage: lastErr };
  }

  private toProperties(q: ScreeningQuery): Record<string, string[]> {
    const props: Record<string, string[]> = { name: [q.name] };
    if (q.birthDate) props.birthDate = [q.birthDate];
    if (q.nationality) props.nationality = [q.nationality];
    if (q.jurisdiction) props.jurisdiction = [q.jurisdiction];
    if (q.registrationNumber) props.registrationNumber = [q.registrationNumber];
    return props;
  }

  private toHit = (r: RawResult): ProviderHit => ({
    externalId: r.id,
    matchedName: r.caption ?? "",
    matchedSchema: r.schema ?? "",
    matchedTopics: Array.isArray(r.properties?.topics) ? r.properties!.topics! : [],
    matchScore: r.score ?? 0,
    matchedListings: r.datasets ?? [],
    matchUrl: r.id ? `https://www.opensanctions.org/entities/${r.id}/` : undefined,
  });
}

interface RawResult {
  id: string;
  score?: number;
  caption?: string;
  schema?: string;
  properties?: { topics?: string[] };
  datasets?: string[];
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const safeText = async (r: Response): Promise<string> => {
  try { return await r.text(); } catch { return ""; }
};
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/providers/__tests__/screening.opensanctions.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/screening.opensanctions.ts src/lib/providers/__tests__/screening.opensanctions.test.ts
git commit -m "feat(screening): implement OpenSanctionsProvider with retry + threshold"
```

---

## Phase 4 — Compliance services (TDD)

### Task 9: `runScreening` service (with mocked provider)

**Files:**
- Create: `src/lib/services/compliance/screening.ts`
- Create: `src/lib/services/compliance/__tests__/screening.test.ts`

For these service tests we mock the provider via `__setScreeningProviderForTests` and use a stub Prisma client.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { __setScreeningProviderForTests } from "@/lib/providers/screening";
import type { ScreeningProvider, ScreeningResult } from "@/lib/providers/screening";

// Mock @/lib/db with an in-memory stub.
const db = vi.hoisted(() => {
  const screeningRuns: any[] = [];
  const kycCases = new Map<string, any>();
  const hits: any[] = [];
  return {
    screeningRuns, kycCases, hits,
    seed(id: string, party: any) {
      kycCases.set(id, { id, party, state: "in_progress", latestScreeningRunId: null });
    },
    reset() { screeningRuns.length = 0; hits.length = 0; kycCases.clear(); },
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    kycCase: {
      findUnique: async ({ where: { id } }: any) => db.kycCases.get(id) ?? null,
      update: async ({ where: { id }, data }: any) => {
        const c = db.kycCases.get(id);
        Object.assign(c, data);
        return c;
      },
    },
    screeningRun: {
      create: async ({ data, include }: any) => {
        const run = { id: `run-${db.screeningRuns.length + 1}`, ...data, hits: [] };
        db.screeningRuns.push(run);
        return run;
      },
    },
    screeningHit: {
      createMany: async ({ data }: any) => {
        db.hits.push(...data);
        return { count: data.length };
      },
    },
    $transaction: async (fn: any) => fn(this),
  },
}));

import { runScreening } from "../screening";

beforeEach(() => { db.reset(); });

function provider(result: ScreeningResult): ScreeningProvider {
  return { name: "stub", match: vi.fn().mockResolvedValue(result) };
}

describe("runScreening", () => {
  it("writes a clear ScreeningRun and updates kyc.latestScreeningRunId", async () => {
    db.seed("k1", { type: "individual", fullName: "Jane", dateOfBirth: null, nationality: "CY" });
    __setScreeningProviderForTests(provider({ outcome: "clear", hits: [], raw: {} }));
    const run = await runScreening("k1", { actorId: null });
    expect(run.outcome).toBe("clear");
    expect(db.kycCases.get("k1").latestScreeningRunId).toBe(run.id);
    expect(db.hits).toHaveLength(0);
  });

  it("persists hits when provider returns matches", async () => {
    db.seed("k1", { type: "individual", fullName: "Joe", dateOfBirth: null, nationality: "CY" });
    __setScreeningProviderForTests(provider({
      outcome: "hits",
      hits: [{ externalId: "NK-1", matchedName: "Joe", matchedSchema: "Person", matchedTopics: ["sanction"], matchScore: 0.9, matchedListings: [], matchUrl: "u" }],
      raw: {},
    }));
    const run = await runScreening("k1", { actorId: null });
    expect(run.outcome).toBe("hits");
    expect(run.hitCount).toBe(1);
    expect(db.hits).toHaveLength(1);
  });

  it("on provider error: writes ScreeningRun with outcome=error and does NOT change kyc state", async () => {
    db.seed("k1", { type: "individual", fullName: "Joe", dateOfBirth: null, nationality: "CY" });
    db.kycCases.get("k1").state = "passed";
    __setScreeningProviderForTests(provider({ outcome: "error", hits: [], errorMessage: "boom" }));
    const run = await runScreening("k1", { actorId: null });
    expect(run.outcome).toBe("error");
    expect(db.kycCases.get("k1").state).toBe("passed");
  });
});
```

- [ ] **Step 2: Run, confirm fails**

- [ ] **Step 3: Implement**

`src/lib/services/compliance/screening.ts`:
```ts
import { prisma } from "@/lib/db";
import { screening, type ScreeningQuery } from "@/lib/providers/screening";

export async function runScreening(kycCaseId: string, opts: { actorId: string | null }) {
  const kyc = await prisma.kycCase.findUnique({
    where: { id: kycCaseId },
    include: { party: true },
  });
  if (!kyc) throw new Error("KycCase not found");
  if (!kyc.party) throw new Error("KycCase missing party");

  const query: ScreeningQuery = kyc.party.type === "individual" ? {
    schema: "Person",
    name: kyc.party.fullName,
    birthDate: kyc.party.dateOfBirth ? toISODate(kyc.party.dateOfBirth) : undefined,
    nationality: kyc.party.nationality ?? undefined,
  } : {
    schema: "Organization",
    name: kyc.party.fullName,
    jurisdiction: kyc.party.jurisdiction ?? undefined,
    registrationNumber: kyc.party.registrationNumber ?? undefined,
  };

  const result = await screening().match(query);

  const run = await prisma.screeningRun.create({
    data: {
      kycCaseId,
      provider: screening().name,
      query: query as object,
      ranByActorId: opts.actorId,
      outcome: result.outcome,
      hitCount: result.hits.length,
      rawResponse: (result.raw ?? null) as object | null,
      errorMessage: result.errorMessage ?? null,
    },
  });

  if (result.hits.length > 0) {
    await prisma.screeningHit.createMany({
      data: result.hits.map((h) => ({
        screeningRunId: run.id,
        externalId: h.externalId,
        matchedName: h.matchedName,
        matchedSchema: h.matchedSchema,
        matchedTopics: h.matchedTopics,
        matchScore: h.matchScore,
        matchedListings: h.matchedListings as object,
        matchUrl: h.matchUrl ?? null,
      })),
    });
  }

  if (result.outcome !== "error") {
    await prisma.kycCase.update({
      where: { id: kycCaseId },
      data: { latestScreeningRunId: run.id },
    });
  }

  return run;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/lib/services/compliance/__tests__/screening.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/compliance/screening.ts src/lib/services/compliance/__tests__/screening.test.ts
git commit -m "feat(compliance): add runScreening service"
```

---

### Task 10: ComplianceFile create + auto-link onboarding docs

**Files:**
- Create: `src/lib/services/compliance/files.ts`
- Modify: `src/lib/services/submissions.ts` (call into the new service on submit)

- [ ] **Step 1: Implement `createComplianceFileForProspect`**

`src/lib/services/compliance/files.ts`:
```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export async function createComplianceFileForProspect(prospectId: string, actorId: string | null) {
  const existing = await prisma.complianceFile.findUnique({ where: { prospectId } });
  if (existing) return existing;

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: { user: true, documents: true },
  });
  if (!prospect) throw new Error("Prospect not found");

  const file = await prisma.$transaction(async (tx) => {
    const cf = await tx.complianceFile.create({
      data: { prospectId, status: "open" },
    });

    const mainParty = await tx.party.create({
      data: {
        complianceFileId: cf.id,
        type: "individual",
        role: "main_contact",
        fullName: prospect.user.fullName,
        nationality: null, // filled later by staff or from prospect details
      },
    });
    const kyc = await tx.kycCase.create({
      data: { partyId: mainParty.id },
    });

    // Auto-link onboarding docs by inferring purpose from DocType.
    for (const doc of prospect.documents) {
      const purpose = doc.type === "passport"
        ? "passport"
        : doc.type === "proof_of_address"
          ? "proof_of_address"
          : "other";
      await tx.document.update({
        where: { id: doc.id },
        data: { partyId: mainParty.id, purpose },
      });
      if (purpose === "passport") {
        await tx.kycCase.update({ where: { id: kyc.id }, data: { passportDocId: doc.id } });
      } else if (purpose === "proof_of_address") {
        await tx.kycCase.update({ where: { id: kyc.id }, data: { proofOfAddressDocId: doc.id } });
      }
    }
    return cf;
  });

  await logActivity({
    entityType: "compliance_file" as never,
    entityId: file.id,
    action: "compliance.file_created" as never,
    actorId: actorId ?? undefined,
    meta: { prospectId },
  });
  return file;
}
```

- [ ] **Step 2: Hook into submission acceptance**

Open `src/lib/services/submissions.ts`. Find the function that finalises a submission (the one that flips status to `submitted` / creates the prospect; locate by searching `submission.created` activity action). After the prospect is saved and before the function returns, add:

```ts
import { createComplianceFileForProspect } from "@/lib/services/compliance/files";
// …
await createComplianceFileForProspect(prospect.id, /* actorId */ user.id);
```

- [ ] **Step 3: Smoke-test in dev**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart web
until curl -fsS http://localhost/api/health > /dev/null; do sleep 1; done
```
Then in the browser register a new prospect and submit onboarding. After:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U oro -d oro \
  -c "SELECT id, \"prospectId\", status FROM \"ComplianceFile\";"
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T db psql -U oro -d oro \
  -c "SELECT id, role, \"fullName\" FROM \"Party\";"
```
Expected: one ComplianceFile + one main_contact Party + (where docs were uploaded) Documents with the new `partyId` populated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/compliance/files.ts src/lib/services/submissions.ts
git commit -m "feat(compliance): create ComplianceFile + main_contact on submission"
```

---

### Task 11: Party CRUD + KYC update services

**Files:**
- Create: `src/lib/services/compliance/parties.ts`
- Modify: `src/lib/services/activity.ts` (extend unions)

- [ ] **Step 1: Extend activity types**

In `src/lib/services/activity.ts`, modify the `ActivityAction` union to include:

```ts
  | "compliance.file_created"
  | "compliance.party_added"
  | "compliance.party_removed"
  | "compliance.idv_verified"
  | "compliance.idv_failed"
  | "compliance.screening_run"
  | "compliance.hit_reviewed"
  | "compliance.risk_assessed"
  | "compliance.risk_overridden"
  | "compliance.signed_off"
  | "compliance.blocked"
  | "compliance.review_task_created"
  | "compliance.review_task_completed"
```

And the `entityType` union in `logActivity` args:
```ts
  entityType: "prospect" | "client" | "document" | "booking" | "user"
    | "compliance_file" | "party" | "kyc_case" | "screening_run" | "review_task";
```

Drop the `as never` casts I added in Task 10 once this compiles.

- [ ] **Step 2: Implement party services**

`src/lib/services/compliance/parties.ts`:
```ts
import { prisma } from "@/lib/db";
import type { PartyRole, PartyType } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface NewPartyInput {
  type: PartyType;
  role: PartyRole;
  fullName: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  countryOfResidence?: string | null;
  passportNumber?: string | null;
  registrationNumber?: string | null;
  jurisdiction?: string | null;
  ownershipPct?: number | null;
  isPep?: boolean;
}

export async function addParty(complianceFileId: string, input: NewPartyInput, actorId: string) {
  const party = await prisma.$transaction(async (tx) => {
    const created = await tx.party.create({
      data: {
        complianceFileId,
        type: input.type,
        role: input.role,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        nationality: input.nationality ?? null,
        countryOfResidence: input.countryOfResidence ?? null,
        passportNumber: input.passportNumber ?? null,
        registrationNumber: input.registrationNumber ?? null,
        jurisdiction: input.jurisdiction ?? null,
        ownershipPct: input.ownershipPct ?? null,
        isPep: input.isPep ?? false,
      },
    });
    await tx.kycCase.create({ data: { partyId: created.id } });
    return created;
  });
  await logActivity({
    entityType: "party",
    entityId: party.id,
    action: "compliance.party_added",
    actorId,
    meta: { complianceFileId, role: input.role, fullName: input.fullName },
  });
  return party;
}

export async function updateParty(partyId: string, patch: Partial<NewPartyInput>, actorId: string) {
  await prisma.party.update({
    where: { id: partyId },
    data: {
      ...(patch.fullName !== undefined && { fullName: patch.fullName }),
      ...(patch.dateOfBirth !== undefined && { dateOfBirth: patch.dateOfBirth ? new Date(patch.dateOfBirth) : null }),
      ...(patch.nationality !== undefined && { nationality: patch.nationality }),
      ...(patch.countryOfResidence !== undefined && { countryOfResidence: patch.countryOfResidence }),
      ...(patch.passportNumber !== undefined && { passportNumber: patch.passportNumber }),
      ...(patch.registrationNumber !== undefined && { registrationNumber: patch.registrationNumber }),
      ...(patch.jurisdiction !== undefined && { jurisdiction: patch.jurisdiction }),
      ...(patch.ownershipPct !== undefined && { ownershipPct: patch.ownershipPct }),
      ...(patch.isPep !== undefined && { isPep: patch.isPep }),
      ...(patch.role !== undefined && { role: patch.role }),
    },
  });
}

export async function removeParty(partyId: string, actorId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { kycCase: { include: { screeningRuns: { take: 1 } } } },
  });
  if (!party) throw new Error("Party not found");
  if (party.role === "main_contact") throw new Error("Cannot remove main_contact party");
  if ((party.kycCase?.screeningRuns?.length ?? 0) > 0) {
    throw new Error("Party has screening history; cannot remove (audit). Consider editing instead.");
  }
  await prisma.party.delete({ where: { id: partyId } });
  await logActivity({
    entityType: "party",
    entityId: partyId,
    action: "compliance.party_removed",
    actorId,
    meta: { complianceFileId: party.complianceFileId },
  });
}

export interface IdvUpdate {
  idvStatus?: "pending" | "verified" | "failed";
  idvNote?: string | null;
  passportDocId?: string | null;
  proofOfAddressDocId?: string | null;
  sofDocId?: string | null;
  sofNote?: string | null;
}

export async function updateKycCase(partyId: string, patch: IdvUpdate, actorId: string) {
  const kyc = await prisma.kycCase.findUnique({ where: { partyId } });
  if (!kyc) throw new Error("KycCase not found");

  const stateNext = patch.idvStatus === "verified"
    ? "passed" : patch.idvStatus === "failed" ? "blocked" : kyc.state;

  const updated = await prisma.kycCase.update({
    where: { partyId },
    data: {
      ...(patch.idvStatus !== undefined && {
        idvStatus: patch.idvStatus,
        idvReviewedById: actorId,
        idvReviewedAt: new Date(),
      }),
      ...(patch.idvNote !== undefined && { idvNote: patch.idvNote }),
      ...(patch.passportDocId !== undefined && { passportDocId: patch.passportDocId }),
      ...(patch.proofOfAddressDocId !== undefined && { proofOfAddressDocId: patch.proofOfAddressDocId }),
      ...(patch.sofDocId !== undefined && { sofDocId: patch.sofDocId }),
      ...(patch.sofNote !== undefined && { sofNote: patch.sofNote }),
      state: stateNext,
    },
  });

  if (patch.idvStatus === "verified") {
    await logActivity({
      entityType: "kyc_case", entityId: updated.id,
      action: "compliance.idv_verified", actorId,
    });
  } else if (patch.idvStatus === "failed") {
    await logActivity({
      entityType: "kyc_case", entityId: updated.id,
      action: "compliance.idv_failed", actorId,
      meta: { note: patch.idvNote },
    });
  }
  return updated;
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npm run typecheck
git add src/lib/services/activity.ts src/lib/services/compliance/parties.ts src/lib/services/compliance/files.ts
git commit -m "feat(compliance): party CRUD + KYC update services + activity actions"
```

---

### Task 12: Hit review + isPep auto-flip + risk persistence

**Files:**
- Create: `src/lib/services/compliance/hits.ts`
- Create: `src/lib/services/compliance/risk-persist.ts`

- [ ] **Step 1: Hit review service**

`src/lib/services/compliance/hits.ts`:
```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export async function reviewHit(
  hitId: string,
  next: "false_positive" | "confirmed_match" | "escalated",
  note: string | null,
  actorId: string,
) {
  if ((next === "confirmed_match" || next === "escalated") && !note) {
    throw new Error("A note is required for confirmed_match or escalated");
  }
  const hit = await prisma.screeningHit.findUnique({
    where: { id: hitId },
    include: { screeningRun: { include: { kycCase: { include: { party: true } } } } },
  });
  if (!hit) throw new Error("Hit not found");

  await prisma.screeningHit.update({
    where: { id: hitId },
    data: {
      reviewStatus: next,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });

  // Auto-flip isPep when confirming a PEP match
  if (next === "confirmed_match" && hit.matchedTopics.includes("role.pep")) {
    await prisma.party.update({ where: { id: hit.screeningRun.kycCase.party.id }, data: { isPep: true } });
  }

  // Auto-block ComplianceFile when confirming a sanctions match
  if (next === "confirmed_match" && hit.matchedTopics.includes("sanction")) {
    const partyId = hit.screeningRun.kycCase.party.id;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (party) {
      await prisma.complianceFile.update({
        where: { id: party.complianceFileId },
        data: { status: "blocked" },
      });
      await logActivity({
        entityType: "compliance_file", entityId: party.complianceFileId,
        action: "compliance.blocked", actorId,
        meta: { reason: "confirmed_sanctions_match", hitId },
      });
    }
  }

  await logActivity({
    entityType: "screening_run", entityId: hit.screeningRunId,
    action: "compliance.hit_reviewed", actorId,
    meta: { hitId, next, topics: hit.matchedTopics },
  });
}
```

- [ ] **Step 2: Risk persistence service**

`src/lib/services/compliance/risk-persist.ts`:
```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { computeRisk, type PartyInput, type RiskRatingLabel } from "./risk";

export async function recomputeAndStoreRisk(complianceFileId: string, actorId: string | null) {
  const file = await prisma.complianceFile.findUnique({
    where: { id: complianceFileId },
    include: {
      parties: true,
      prospect: true,
    },
  });
  if (!file) throw new Error("File not found");

  const parties: PartyInput[] = file.parties.map((p) => ({
    role: p.role,
    isPep: p.isPep,
    nationality: p.nationality,
    countryOfResidence: p.countryOfResidence,
    jurisdiction: p.jurisdiction,
  }));

  const draft = (file.prospect?.draft as Record<string, unknown> | null) ?? {};
  const result = computeRisk({
    parties,
    expectedTurnover: ((draft.expectedTurnover as string) ?? "<50K") as never,
    businessActivity: (draft.businessActivity as string) ?? null,
    hasNominees: Boolean(draft.nomineeServices),
    entityLayers: 1,
  });

  await prisma.complianceFile.update({
    where: { id: complianceFileId },
    data: {
      riskComputed: result.rating,
      riskComputedScore: result.score,
      riskAssessedAt: new Date(),
      riskAssessedById: actorId,
    },
  });

  await logActivity({
    entityType: "compliance_file", entityId: complianceFileId,
    action: "compliance.risk_assessed", actorId: actorId ?? undefined,
    meta: { rating: result.rating, score: result.score, factors: result.factors },
  });

  return result;
}

export async function overrideRiskRating(
  complianceFileId: string, rating: RiskRatingLabel, reason: string, actorId: string,
) {
  if (!reason || reason.trim().length < 5) throw new Error("Override reason required");
  const file = await prisma.complianceFile.findUnique({ where: { id: complianceFileId } });
  if (!file) throw new Error("File not found");

  const escalated = file.riskComputed && rank(rating) < rank(file.riskComputed);
  await prisma.complianceFile.update({
    where: { id: complianceFileId },
    data: {
      riskRating: rating,
      riskOverrideReason: reason,
      riskAssessedAt: new Date(),
      riskAssessedById: actorId,
    },
  });

  await logActivity({
    entityType: "compliance_file", entityId: complianceFileId,
    action: "compliance.risk_overridden", actorId,
    meta: { before: file.riskComputed, after: rating, reason, escalated: !!escalated },
  });
}

function rank(r: string) { return r === "low" ? 0 : r === "standard" ? 1 : 2; }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/compliance/hits.ts src/lib/services/compliance/risk-persist.ts
git commit -m "feat(compliance): hit review (auto-block on sanctions) + risk persist/override"
```

---

### Task 13: Sign-off gate + conversion gate

**Files:**
- Create: `src/lib/services/compliance/sign-off.ts`
- Create: `src/lib/services/compliance/gate.ts`
- Modify: existing conversion service (find via `grep`)

- [ ] **Step 1: Sign-off service**

`src/lib/services/compliance/sign-off.ts`:
```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export async function signOffComplianceFile(complianceFileId: string, note: string, actorId: string) {
  if (!note || note.trim().length < 5) throw new Error("Sign-off note required");
  const file = await prisma.complianceFile.findUnique({
    where: { id: complianceFileId },
    include: { parties: { include: { kycCase: { include: { screeningRuns: { include: { hits: true }, orderBy: { ranAt: "desc" }, take: 1 } } } } } },
  });
  if (!file) throw new Error("File not found");
  if (file.status === "blocked") throw new Error("Cannot sign off a blocked file");
  if (!file.riskRating) throw new Error("Risk rating must be set before sign-off");

  for (const party of file.parties) {
    if (!party.kycCase || party.kycCase.state !== "passed") {
      throw new Error(`Party ${party.fullName} not yet passed`);
    }
    const latest = party.kycCase.screeningRuns[0];
    if (latest?.hits.some((h) => h.reviewStatus === "unreviewed")) {
      throw new Error(`Party ${party.fullName} has unreviewed hits`);
    }
  }

  await prisma.complianceFile.update({
    where: { id: complianceFileId },
    data: {
      status: "cleared",
      signedOffById: actorId,
      signedOffAt: new Date(),
      signedOffNote: note,
    },
  });
  await logActivity({
    entityType: "compliance_file", entityId: complianceFileId,
    action: "compliance.signed_off", actorId,
    meta: { note },
  });
}
```

- [ ] **Step 2: Gate helper**

`src/lib/services/compliance/gate.ts`:
```ts
import { prisma } from "@/lib/db";

export type GateOk = { ok: true };
export type GateFail = { ok: false; reason: "compliance_not_cleared" | "compliance_blocked" | "no_compliance_file" };

export async function checkComplianceGateForProspect(prospectId: string): Promise<GateOk | GateFail> {
  const file = await prisma.complianceFile.findUnique({ where: { prospectId }, select: { status: true } });
  if (!file) return { ok: false, reason: "no_compliance_file" };
  if (file.status === "blocked") return { ok: false, reason: "compliance_blocked" };
  if (file.status !== "cleared") return { ok: false, reason: "compliance_not_cleared" };
  return { ok: true };
}
```

- [ ] **Step 3: Wire the gate into the existing conversion**

Find the conversion service:
```bash
grep -rn "convertProspectToClient\|convertProspect" src/lib/services/ src/app/api/ | head
```

Open the file. At the very top of the function (right after the role assertion), add:
```ts
import { checkComplianceGateForProspect } from "@/lib/services/compliance/gate";
// …
const gate = await checkComplianceGateForProspect(prospectId);
if (!gate.ok) {
  throw Object.assign(new Error("COMPLIANCE_GATE_FAILED"), { reason: gate.reason });
}
```

After the existing `Client.create({ ... })` call, also attach the file:
```ts
await prisma.complianceFile.update({
  where: { prospectId },
  data: { clientId: client.id },
});
```

- [ ] **Step 4: Surface the gate error in the convert API**

Find the route that calls `convertProspectToClient` (likely `src/app/api/admin/clients/convert/route.ts`). In the `try/catch`, add:
```ts
} catch (e) {
  const err = e as { message?: string; reason?: string };
  if (err.message === "COMPLIANCE_GATE_FAILED") {
    return NextResponse.json({ error: err.reason ?? "compliance_not_cleared" }, { status: 409 });
  }
  throw e;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/compliance/sign-off.ts src/lib/services/compliance/gate.ts \
  src/lib/services/clients.ts src/app/api/admin/clients/convert/route.ts
git commit -m "feat(compliance): sign-off service + conversion gate"
```

(File paths in `git add` should match the conversion-service file you found.)

---

## Phase 5 — API routes

### Task 14: File-scoped routes (GET + sign-off + recompute + risk override)

**Files:**
- Create: `src/app/api/admin/compliance/files/[id]/route.ts`
- Create: `src/app/api/admin/compliance/files/[id]/sign-off/route.ts`
- Create: `src/app/api/admin/compliance/files/[id]/recompute-risk/route.ts`
- Create: `src/app/api/admin/compliance/files/[id]/risk/route.ts`

- [ ] **Step 1: GET file**

`src/app/api/admin/compliance/files/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertRole("staff");
  const { id } = await params;
  const file = await prisma.complianceFile.findUnique({
    where: { id },
    include: {
      parties: {
        include: {
          kycCase: {
            include: {
              latestScreeningRun: { include: { hits: true } },
            },
          },
        },
      },
      reviewTasks: { where: { state: "open" }, orderBy: { createdAt: "desc" } },
      signedOff: { select: { id: true, fullName: true, email: true } },
      riskAssessedBy: { select: { id: true, fullName: true } },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ file });
}
```

- [ ] **Step 2: Sign-off POST**

`src/app/api/admin/compliance/files/[id]/sign-off/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { signOffComplianceFile } from "@/lib/services/compliance/sign-off";

export const runtime = "nodejs";

const schema = z.object({ note: z.string().min(5).max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    await signOffComplianceFile(id, body.data.note, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Recompute risk POST**

`src/app/api/admin/compliance/files/[id]/recompute-risk/route.ts`:
```ts
import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { recomputeAndStoreRisk } from "@/lib/services/compliance/risk-persist";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const result = await recomputeAndStoreRisk(id, me.id);
  return NextResponse.json({ ok: true, result });
}
```

- [ ] **Step 4: Risk override PATCH**

`src/app/api/admin/compliance/files/[id]/risk/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { overrideRiskRating } from "@/lib/services/compliance/risk-persist";

export const runtime = "nodejs";

const schema = z.object({
  rating: z.enum(["low", "standard", "high"]),
  reason: z.string().min(5).max(2000),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    await overrideRiskRating(id, body.data.rating, body.data.reason, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 5: Smoke-test + commit**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web sh -c \
  "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/admin/compliance/files/dummy"
```
Expected: `401` or `307` (auth redirect). Means the route mounted.

```bash
git add src/app/api/admin/compliance/files
git commit -m "feat(compliance): file-scoped API routes (GET, sign-off, risk)"
```

---

### Task 15: Party + KYC + screening API routes

**Files:**
- Create: `src/app/api/admin/compliance/files/[id]/parties/route.ts`
- Create: `src/app/api/admin/compliance/parties/[id]/route.ts`
- Create: `src/app/api/admin/compliance/parties/[id]/kyc/route.ts`
- Create: `src/app/api/admin/compliance/parties/[id]/screen/route.ts`
- Create: `src/app/api/admin/compliance/parties/[id]/documents/route.ts`

- [ ] **Step 1: Add party POST**

`src/app/api/admin/compliance/files/[id]/parties/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { addParty } from "@/lib/services/compliance/parties";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["individual", "entity"]),
  role: z.enum(["main_contact", "ubo", "director", "shareholder", "signatory", "intermediary"]),
  fullName: z.string().min(2).max(150),
  dateOfBirth: z.string().date().optional().nullable(),
  nationality: z.string().length(2).optional().nullable(),
  countryOfResidence: z.string().length(2).optional().nullable(),
  passportNumber: z.string().max(40).optional().nullable(),
  registrationNumber: z.string().max(60).optional().nullable(),
  jurisdiction: z.string().length(2).optional().nullable(),
  ownershipPct: z.coerce.number().min(0).max(100).optional().nullable(),
  isPep: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const p = await addParty(id, body.data, me.id);
  return NextResponse.json({ ok: true, id: p.id });
}
```

- [ ] **Step 2: Party PATCH + DELETE**

`src/app/api/admin/compliance/parties/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateParty, removeParty } from "@/lib/services/compliance/parties";

export const runtime = "nodejs";

const patchSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  nationality: z.string().length(2).optional().nullable(),
  countryOfResidence: z.string().length(2).optional().nullable(),
  passportNumber: z.string().max(40).optional().nullable(),
  registrationNumber: z.string().max(60).optional().nullable(),
  jurisdiction: z.string().length(2).optional().nullable(),
  ownershipPct: z.coerce.number().min(0).max(100).optional().nullable(),
  isPep: z.boolean().optional(),
  role: z.enum(["main_contact", "ubo", "director", "shareholder", "signatory", "intermediary"]).optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  await updateParty(id, body.data, me.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  try {
    await removeParty(id, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: KYC PATCH**

`src/app/api/admin/compliance/parties/[id]/kyc/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateKycCase } from "@/lib/services/compliance/parties";

export const runtime = "nodejs";

const schema = z.object({
  idvStatus: z.enum(["pending", "verified", "failed"]).optional(),
  idvNote: z.string().max(2000).nullable().optional(),
  passportDocId: z.string().uuid().nullable().optional(),
  proofOfAddressDocId: z.string().uuid().nullable().optional(),
  sofDocId: z.string().uuid().nullable().optional(),
  sofNote: z.string().max(2000).nullable().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  if (body.data.idvStatus === "failed" && !body.data.idvNote) {
    return NextResponse.json({ error: "Failure requires a note" }, { status: 422 });
  }
  await updateKycCase(id, body.data, me.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Screen POST**

`src/app/api/admin/compliance/parties/[id]/screen/route.ts`:
```ts
import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { runScreening } from "@/lib/services/compliance/screening";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const kyc = await prisma.kycCase.findUnique({ where: { partyId: id }, select: { id: true } });
  if (!kyc) return NextResponse.json({ error: "KycCase not found" }, { status: 404 });
  const run = await runScreening(kyc.id, { actorId: me.id });
  return NextResponse.json({ ok: true, runId: run.id, outcome: run.outcome, hitCount: run.hitCount });
}
```

- [ ] **Step 5: Document upload POST (reuses existing upload service)**

`src/app/api/admin/compliance/parties/[id]/documents/route.ts`:
```ts
import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { uploadDocument, MAX_BYTES } from "@/lib/services/documents";
import type { DocType } from "@prisma/client";

export const runtime = "nodejs";

const ALLOWED: DocType[] = ["passport", "proof_of_address", "other"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id: partyId } = await params;
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { complianceFile: { include: { prospect: true } } },
  });
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (!party.complianceFile.prospect) return NextResponse.json({ error: "Compliance file missing prospect link" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  const file = form.get("file");
  const purposeRaw = String(form.get("purpose") ?? "other");
  const typeMap: Record<string, DocType> = {
    passport: "passport",
    proof_of_address: "proof_of_address",
    sof: "other",
    other: "other",
  };
  const type = typeMap[purposeRaw];
  if (!type || !ALLOWED.includes(type)) return NextResponse.json({ error: "Invalid purpose" }, { status: 422 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadDocument({
    prospectId: party.complianceFile.prospect.id,
    userId: me.id,
    type,
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    buffer,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });

  // Link the freshly-uploaded document to the party with the requested purpose
  await prisma.document.update({
    where: { id: result.doc.id },
    data: { partyId, purpose: purposeRaw as never },
  });
  return NextResponse.json({ ok: true, documentId: result.doc.id });
}
```

- [ ] **Step 6: Smoke-test mounts + commit**

```bash
for p in /api/admin/compliance/files/X/parties /api/admin/compliance/parties/X /api/admin/compliance/parties/X/kyc /api/admin/compliance/parties/X/screen /api/admin/compliance/parties/X/documents; do
  printf "%-60s -> HTTP " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost$p"
done
```
Expected: each route returns `401` / `307` / `404` (depending on method), not 500. Means it mounted.

```bash
git add src/app/api/admin/compliance/files src/app/api/admin/compliance/parties
git commit -m "feat(compliance): party + KYC + screening + document API routes"
```

---

### Task 16: Hit review + ReviewTask PATCH routes

**Files:**
- Create: `src/app/api/admin/compliance/hits/[id]/route.ts`
- Create: `src/app/api/admin/compliance/tasks/[id]/route.ts`

- [ ] **Step 1: Hit PATCH**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { reviewHit } from "@/lib/services/compliance/hits";

export const runtime = "nodejs";

const schema = z.object({
  reviewStatus: z.enum(["false_positive", "confirmed_match", "escalated"]),
  note: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    await reviewHit(id, body.data.reviewStatus, body.data.note ?? null, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Task PATCH**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export const runtime = "nodejs";

const schema = z.object({
  state: z.enum(["completed", "dismissed"]),
  note: z.string().max(2000).optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const task = await prisma.reviewTask.update({
    where: { id },
    data: {
      state: body.data.state,
      completedAt: new Date(),
      ...(body.data.note !== undefined && { note: body.data.note }),
    },
  });
  await logActivity({
    entityType: "review_task", entityId: id,
    action: "compliance.review_task_completed", actorId: me.id,
    meta: { state: body.data.state, complianceFileId: task.complianceFileId },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/compliance/hits src/app/api/admin/compliance/tasks
git commit -m "feat(compliance): hit + review-task API routes"
```

---

## Phase 6 — Worker jobs

### Task 17: Auto re-screening cron

**Files:**
- Create: `src/worker/jobs/auto-rescreen.ts`

- [ ] **Step 1: Implement the job**

```ts
import { prisma } from "@/lib/db";
import { runScreening } from "@/lib/services/compliance/screening";
import { diffHitsForAlert } from "@/lib/services/compliance/hit-dedup";
import { logActivity } from "@/lib/services/activity";

const CADENCE_DAYS = { high: 30, standard: 90, low: 365 };

export async function autoRescreenTick() {
  const start = Date.now();
  const cutoff = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const due = await prisma.kycCase.findMany({
    where: {
      state: "passed",
      party: { complianceFile: { riskRating: { not: null }, status: "cleared" } },
      OR: [
        { latestScreeningRun: { is: null } },
        { latestScreeningRun: { ranAt: { lt: cutoff(365) } } }, // floor; refined per case below
      ],
    },
    include: {
      party: { include: { complianceFile: true } },
      latestScreeningRun: { include: { hits: true } },
    },
    take: 100,
  });

  let created = 0;
  for (const kyc of due) {
    const rating = kyc.party.complianceFile.riskRating ?? "low";
    const cutoffForBand = cutoff(CADENCE_DAYS[rating as keyof typeof CADENCE_DAYS]);
    if (kyc.latestScreeningRun && kyc.latestScreeningRun.ranAt >= cutoffForBand) continue;

    try {
      const previousHits = (kyc.latestScreeningRun?.hits ?? []).map((h) => ({
        externalId: h.externalId, topics: h.matchedTopics,
      }));
      const run = await runScreening(kyc.id, { actorId: null });
      if (run.outcome === "error") continue;

      const newRun = await prisma.screeningRun.findUnique({
        where: { id: run.id },
        include: { hits: true },
      });
      const currentHits = (newRun?.hits ?? []).map((h) => ({
        externalId: h.externalId, topics: h.matchedTopics,
      }));
      if (diffHitsForAlert(previousHits, currentHits)) {
        await prisma.reviewTask.create({
          data: {
            complianceFileId: kyc.party.complianceFileId,
            kind: "screening_hit",
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            note: `New/changed hits for ${kyc.party.fullName}`,
          },
        });
        await logActivity({
          entityType: "compliance_file", entityId: kyc.party.complianceFileId,
          action: "compliance.review_task_created",
          meta: { kind: "screening_hit", kycCaseId: kyc.id },
        });
        created += 1;
      }
      await new Promise((r) => setTimeout(r, 250)); // throttle
    } catch (e) {
      console.error("[auto-rescreen] kycCaseId=%s error=%s", kyc.id, (e as Error).message);
    }
  }
  console.log("[auto-rescreen] checked=%d tasksCreated=%d durationMs=%d", due.length, created, Date.now() - start);
}
```

- [ ] **Step 2: Commit** (registered in Task 19 below)

```bash
git add src/worker/jobs/auto-rescreen.ts
git commit -m "feat(worker): hourly auto re-screening job"
```

---

### Task 18: Periodic review reminder cron

**Files:**
- Create: `src/worker/jobs/periodic-review.ts`

- [ ] **Step 1: Implement**

```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

const CADENCE_DAYS = { high: 180, standard: 365, low: 730 };

export async function periodicReviewTick() {
  const start = Date.now();
  const files = await prisma.complianceFile.findMany({
    where: { status: "cleared", riskRating: { not: null } },
    select: { id: true, riskRating: true, reviewTasks: { where: { kind: "periodic_review" } } },
  });

  let created = 0;
  for (const f of files) {
    const openExists = f.reviewTasks.some((t) => t.state === "open");
    if (openExists) continue;
    const lastDone = f.reviewTasks
      .filter((t) => t.state === "completed")
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0];
    const cadence = CADENCE_DAYS[f.riskRating as keyof typeof CADENCE_DAYS];
    const since = lastDone?.completedAt ?? null;
    const due = since ? since.getTime() < Date.now() - cadence * 86400000 : true;
    if (!due) continue;

    await prisma.reviewTask.create({
      data: {
        complianceFileId: f.id,
        kind: "periodic_review",
        dueAt: new Date(Date.now() + 14 * 86400000),
      },
    });
    await logActivity({
      entityType: "compliance_file", entityId: f.id,
      action: "compliance.review_task_created",
      meta: { kind: "periodic_review" },
    });
    created += 1;
  }
  console.log("[periodic-review] checked=%d tasksCreated=%d durationMs=%d", files.length, created, Date.now() - start);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/worker/jobs/periodic-review.ts
git commit -m "feat(worker): daily periodic-review reminder job"
```

---

### Task 19: Backfill on worker boot + register cron jobs

**Files:**
- Create: `src/worker/jobs/backfill-compliance.ts`
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Backfill**

```ts
import { prisma } from "@/lib/db";

export async function backfillCompliance() {
  const start = Date.now();
  const prospectsMissing = await prisma.prospect.findMany({
    where: { complianceFile: null },
    include: { user: true },
    take: 1000,
  });
  let created = 0;
  for (const p of prospectsMissing) {
    await prisma.$transaction(async (tx) => {
      const cf = await tx.complianceFile.create({ data: { prospectId: p.id, status: "open" } });
      const party = await tx.party.create({
        data: { complianceFileId: cf.id, type: "individual", role: "main_contact", fullName: p.user.fullName },
      });
      await tx.kycCase.create({ data: { partyId: party.id } });
    });
    created += 1;
  }

  const clientsMissing = await prisma.client.findMany({
    where: { complianceFile: null },
    include: { user: true, prospect: true },
    take: 1000,
  });
  for (const c of clientsMissing) {
    // Reuse the prospect's file if it exists, else create + link client.
    const existing = await prisma.complianceFile.findUnique({ where: { prospectId: c.prospectId } });
    if (existing) {
      await prisma.complianceFile.update({ where: { id: existing.id }, data: { clientId: c.id } });
    } else {
      await prisma.$transaction(async (tx) => {
        const cf = await tx.complianceFile.create({
          data: { prospectId: c.prospectId, clientId: c.id, status: "open" },
        });
        const party = await tx.party.create({
          data: { complianceFileId: cf.id, type: "individual", role: "main_contact", fullName: c.user.fullName },
        });
        await tx.kycCase.create({ data: { partyId: party.id } });
      });
      created += 1;
    }
  }
  console.log("[backfill-compliance] created=%d durationMs=%d", created, Date.now() - start);
}
```

- [ ] **Step 2: Register jobs + run backfill on boot**

Open `src/worker/index.ts`. Add at the top with existing imports:
```ts
import cron from "node-cron";
import { autoRescreenTick } from "./jobs/auto-rescreen";
import { periodicReviewTick } from "./jobs/periodic-review";
import { backfillCompliance } from "./jobs/backfill-compliance";
```

In the boot block (where the existing `console.log('[worker] starting reminders ...')` lives), add:
```ts
backfillCompliance().catch((e) => console.error("[backfill-compliance] failed:", e));

cron.schedule("0 * * * *", () => {
  autoRescreenTick().catch((e) => console.error("[auto-rescreen] tick failed:", e));
});
cron.schedule("0 6 * * *", () => {
  periodicReviewTick().catch((e) => console.error("[periodic-review] tick failed:", e));
});
```

- [ ] **Step 3: Restart worker + verify**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart worker
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=15 worker
```
Expected: `[backfill-compliance] created=N ...` and `[worker] starting reminders ...`.

- [ ] **Step 4: Commit**

```bash
git add src/worker/jobs/backfill-compliance.ts src/worker/index.ts
git commit -m "feat(worker): backfill on boot + register compliance cron jobs"
```

---

## Phase 7 — Admin UI

### Task 20: AdminShell Compliance link + badge

**Files:**
- Modify: `src/components/admin/AdminShell.tsx`
- Modify: `src/app/admin/layout.tsx` (or wherever shell is consumed) — only if a badge feed is needed there

- [ ] **Step 1: Add to nav**

In `src/components/admin/AdminShell.tsx`:
- Extend `AdminTab` to include `"compliance"`.
- Add `<NavLink href="/admin/compliance/tasks" label="Compliance" active={active === "compliance"} />` between `Users` and `Analytics`.

- [ ] **Step 2: Show a simple count badge**

Convert the `<NavLink>` for Compliance to a server-side `<NavBadge>` if needed. Simplest: keep it static; defer the count to Task 22's tasks page.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminShell.tsx
git commit -m "feat(ui): add Compliance to admin nav"
```

---

### Task 21: ComplianceDashboard shared component

**Files:**
- Create: `src/components/compliance/ComplianceDashboard.tsx`
- Create: `src/components/compliance/RiskPanel.tsx`
- Create: `src/components/compliance/PartiesTable.tsx`
- Create: `src/components/compliance/SignOffPanel.tsx`
- Create: `src/components/compliance/AddPartyModal.tsx`

- [ ] **Step 1: ComplianceDashboard (server-rendered wrapper passes data; sub-components are client)**

`src/components/compliance/ComplianceDashboard.tsx`:
```tsx
import { RiskPanel } from "./RiskPanel";
import { PartiesTable } from "./PartiesTable";
import { SignOffPanel } from "./SignOffPanel";
import { AddPartyModal } from "./AddPartyModal";

type Hit = { id: string; matchedName: string; matchedTopics: string[]; reviewStatus: string };
type KycCase = {
  id: string;
  state: "pending" | "in_progress" | "passed" | "blocked";
  latestScreeningRun: null | { id: string; outcome: "clear" | "hits" | "error"; hitCount: number; hits: Hit[] };
};
type Party = {
  id: string;
  role: string;
  fullName: string;
  type: string;
  kycCase: KycCase | null;
};
type File = {
  id: string;
  status: "open" | "in_review" | "cleared" | "blocked";
  riskComputed: string | null;
  riskComputedScore: number | null;
  riskRating: string | null;
  riskOverrideReason: string | null;
  signedOffAt: string | null;
  signedOffNote: string | null;
  parties: Party[];
  reviewTasks: { id: string; kind: string; dueAt: string | null; assignedTo: { fullName: string } | null }[];
};

export function ComplianceDashboard({ file, parentLink }: { file: File; parentLink: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="font-display text-2xl">Compliance file</h2>
          <p className="text-meta text-admin-muted mt-1">Status: <StatusBadge status={file.status} /></p>
        </div>
        <AddPartyModal complianceFileId={file.id} />
      </header>

      <RiskPanel
        fileId={file.id}
        computed={file.riskComputed}
        computedScore={file.riskComputedScore}
        rating={file.riskRating}
        overrideReason={file.riskOverrideReason}
      />

      <PartiesTable fileId={file.id} parties={file.parties} parentLink={parentLink} />

      {file.reviewTasks.length > 0 && (
        <section className="bg-admin-surface border border-admin-border rounded-card p-6">
          <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Open tasks</h3>
          <ul className="flex flex-col gap-2">
            {file.reviewTasks.map((t) => (
              <li key={t.id} className="text-meta">
                <span className="badge badge-pending mr-2">{t.kind.replace("_", " ")}</span>
                {t.dueAt && <span className="font-mono text-admin-muted">due {new Date(t.dueAt).toLocaleDateString()}</span>}
                {t.assignedTo && <span className="ml-3 text-admin-muted">@{t.assignedTo.fullName}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SignOffPanel
        fileId={file.id}
        status={file.status}
        riskRating={file.riskRating}
        signedOffAt={file.signedOffAt}
        signedOffNote={file.signedOffNote}
        parties={file.parties}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "cleared" ? "badge-approved" : status === "blocked" ? "badge-pending" : "badge-pending";
  return <span className={`badge ${cls} capitalize`}>{status.replace("_", " ")}</span>;
}
```

- [ ] **Step 2: RiskPanel (client component)**

`src/components/compliance/RiskPanel.tsx`:
```tsx
"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function RiskPanel({ fileId, computed, computedScore, rating, overrideReason }: {
  fileId: string;
  computed: string | null;
  computedScore: number | null;
  rating: string | null;
  overrideReason: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [next, setNext] = useState<string>(rating ?? computed ?? "standard");
  const [reason, setReason] = useState<string>(overrideReason ?? "");

  function recompute() {
    start(async () => {
      await fetch(`/api/admin/compliance/files/${fileId}/recompute-risk`, { method: "POST" });
      router.refresh();
    });
  }
  function confirmOverride() {
    start(async () => {
      await fetch(`/api/admin/compliance/files/${fileId}/risk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: next, reason: reason || "Confirmed computed rating" }),
      });
      router.refresh();
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-meta font-bold uppercase tracking-widest text-admin-muted">Risk</div>
          <div className="flex gap-2 items-baseline mt-1">
            <span className="badge badge-approved capitalize">{rating ?? "not set"}</span>
            <span className="text-meta text-admin-muted">computed: {computed ?? "—"} ({computedScore ?? "—"})</span>
          </div>
        </div>
        <button type="button" onClick={recompute} disabled={pending} className="btn px-3 py-1.5 text-meta">Re-compute</button>
      </div>
      <div className="mt-4 flex gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Override rating</span>
          <select value={next} onChange={(e) => setNext(e.target.value)} className="input">
            <option value="low">low</option>
            <option value="standard">standard</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Why override?" />
        </label>
        <button type="button" onClick={confirmOverride} disabled={pending} className="btn btn-primary px-4 py-2">Save</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: PartiesTable + AddPartyModal + SignOffPanel**

`src/components/compliance/PartiesTable.tsx`:
```tsx
import Link from "next/link";

export function PartiesTable({ fileId, parties, parentLink }: {
  fileId: string;
  parties: { id: string; role: string; fullName: string; type: string; kycCase: { state: string; latestScreeningRun: null | { outcome: string; hitCount: number } } | null }[];
  parentLink: string;
}) {
  return (
    <section className="bg-admin-surface border border-admin-border rounded-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ background: "#FDFDFD" }}>
            <Th>Party</Th><Th>Role</Th><Th>Type</Th><Th>KYC state</Th><Th>Latest screening</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id} className="border-t border-admin-border">
              <Td className="font-semibold">{p.fullName}</Td>
              <Td>{p.role.replace("_", " ")}</Td>
              <Td>{p.type}</Td>
              <Td><span className="badge badge-pending">{p.kycCase?.state ?? "—"}</span></Td>
              <Td>{p.kycCase?.latestScreeningRun
                ? `${p.kycCase.latestScreeningRun.outcome} (${p.kycCase.latestScreeningRun.hitCount})`
                : "not run"}</Td>
              <Td><Link href={`${parentLink}/parties/${p.id}`} className="text-meta underline">Open</Link></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-admin-muted font-semibold">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`p-4 align-middle text-meta ${className}`}>{children}</td>; }
```

`src/components/compliance/AddPartyModal.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddPartyModal({ complianceFileId }: { complianceFileId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    start(async () => {
      const res = await fetch(`/api/admin/compliance/files/${complianceFileId}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: fd.get("type"),
          role: fd.get("role"),
          fullName: fd.get("fullName"),
          dateOfBirth: fd.get("dateOfBirth") || null,
          nationality: (fd.get("nationality") || null) as string | null,
          ownershipPct: fd.get("ownershipPct") ? Number(fd.get("ownershipPct")) : null,
        }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-primary px-4 py-2">+ Add party</button>;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
    >
      <div className="bg-admin-surface p-6 rounded-card w-[480px] max-w-[90vw] flex flex-col gap-3">
        <h3 className="font-display text-xl">Add party</h3>
        <select name="type" defaultValue="individual" className="input"><option value="individual">Individual</option><option value="entity">Entity</option></select>
        <select name="role" defaultValue="ubo" className="input">
          <option value="ubo">UBO</option><option value="director">Director</option>
          <option value="shareholder">Shareholder</option><option value="signatory">Signatory</option><option value="intermediary">Intermediary</option>
        </select>
        <input name="fullName" required placeholder="Full legal name" className="input" />
        <input name="dateOfBirth" type="date" className="input" />
        <input name="nationality" maxLength={2} placeholder="Nationality (e.g. CY)" className="input" />
        <input name="ownershipPct" type="number" step="0.01" placeholder="Ownership %" className="input" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setOpen(false)} className="btn px-4 py-2">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary px-4 py-2">Add</button>
        </div>
      </div>
    </form>
  );
}
```

`src/components/compliance/SignOffPanel.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SignOffPanel({ fileId, status, riskRating, signedOffAt, signedOffNote, parties }: {
  fileId: string;
  status: string;
  riskRating: string | null;
  signedOffAt: string | null;
  signedOffNote: string | null;
  parties: { kycCase: { state: string; latestScreeningRun: null | { hits: { reviewStatus: string }[] } } | null; fullName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  const reasons: string[] = [];
  if (!riskRating) reasons.push("Risk rating not set");
  if (status === "blocked") reasons.push("File is blocked");
  for (const p of parties) {
    if (p.kycCase?.state !== "passed") reasons.push(`${p.fullName} not passed`);
    if (p.kycCase?.latestScreeningRun?.hits.some((h) => h.reviewStatus === "unreviewed")) reasons.push(`${p.fullName} has unreviewed hits`);
  }
  const canSignOff = reasons.length === 0 && status !== "cleared";

  function signOff() {
    start(async () => {
      const res = await fetch(`/api/admin/compliance/files/${fileId}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Sign-off failed"); }
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-6">
      <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Sign-off</h3>
      {status === "cleared" ? (
        <div className="text-meta">
          ✓ Cleared {signedOffAt && <span className="text-admin-muted">on {new Date(signedOffAt).toLocaleString()}</span>}
          {signedOffNote && <p className="mt-2 italic text-admin-muted">"{signedOffNote}"</p>}
        </div>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sign-off note (min 5 chars)" className="input w-full" rows={3} />
          <button type="button" disabled={pending || !canSignOff} onClick={signOff} className="btn btn-primary px-4 py-2 mt-3 disabled:opacity-50">Sign off</button>
          {reasons.length > 0 && <ul className="mt-3 text-meta text-admin-muted list-disc pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/compliance/
git commit -m "feat(ui): ComplianceDashboard + RiskPanel + PartiesTable + AddParty + SignOff components"
```

---

### Task 22: Compliance pages (file + party + tasks)

**Files:**
- Create: `src/app/admin/clients/[id]/compliance/page.tsx`
- Create: `src/app/admin/clients/[id]/compliance/parties/[partyId]/page.tsx`
- Create: `src/app/admin/submissions/[ref]/compliance/page.tsx`
- Create: `src/app/admin/compliance/tasks/page.tsx`
- Create: `src/components/compliance/PartyWorkspace.tsx`
- Create: `src/components/compliance/IdvChecklist.tsx`
- Create: `src/components/compliance/ScreeningPanel.tsx`
- Create: `src/components/compliance/HitRow.tsx`

- [ ] **Step 1: Client compliance page**

`src/app/admin/clients/[id]/compliance/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { recomputeAndStoreRisk } from "@/lib/services/compliance/risk-persist";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance" };

export default async function ClientCompliancePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const file = await prisma.complianceFile.findFirst({
    where: { clientId: id },
    include: {
      parties: {
        include: {
          kycCase: { include: { latestScreeningRun: { include: { hits: true } } } },
        },
      },
      reviewTasks: { where: { state: "open" }, include: { assignedTo: true } },
    },
  });
  if (!file) notFound();
  // Compute on first visit if never assessed
  if (!file.riskComputed) await recomputeAndStoreRisk(file.id, null);
  return (
    <AdminShell active="clients">
      <ComplianceDashboard file={serialize(file)} parentLink={`/admin/clients/${id}/compliance`} />
    </AdminShell>
  );
}

// Convert Date/Decimal to strings the client component expects.
function serialize(f: any) {
  return {
    ...f,
    signedOffAt: f.signedOffAt?.toISOString() ?? null,
    parties: f.parties.map((p: any) => ({
      ...p,
      kycCase: p.kycCase ? {
        ...p.kycCase,
        latestScreeningRun: p.kycCase.latestScreeningRun ? {
          ...p.kycCase.latestScreeningRun,
          hits: p.kycCase.latestScreeningRun.hits.map((h: any) => ({
            id: h.id, matchedName: h.matchedName, matchedTopics: h.matchedTopics, reviewStatus: h.reviewStatus,
          })),
        } : null,
      } : null,
    })),
    reviewTasks: f.reviewTasks.map((t: any) => ({
      id: t.id, kind: t.kind, dueAt: t.dueAt?.toISOString() ?? null,
      assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
    })),
  };
}
```

- [ ] **Step 2: PartyWorkspace + child components**

`src/components/compliance/PartyWorkspace.tsx`:
```tsx
import { IdvChecklist } from "./IdvChecklist";
import { ScreeningPanel } from "./ScreeningPanel";

export function PartyWorkspace({ party }: {
  party: {
    id: string;
    fullName: string;
    role: string;
    type: string;
    kycCase: {
      id: string;
      idvStatus: string;
      passportDocId: string | null;
      proofOfAddressDocId: string | null;
      sofDocId: string | null;
      latestScreeningRun: null | { id: string; outcome: string; ranAt: string; hits: { id: string; matchedName: string; matchedTopics: string[]; matchScore: number; reviewStatus: string; matchUrl: string | null }[] };
    } | null;
  };
}) {
  return (
    <div className="grid lg:grid-cols-[2fr_3fr] gap-6">
      <section className="bg-admin-surface border border-admin-border rounded-card p-4">
        <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Documents</h3>
        <DocSlot label="Passport"            id={party.kycCase?.passportDocId} />
        <DocSlot label="Proof of address"    id={party.kycCase?.proofOfAddressDocId} />
        <DocSlot label="Source of funds"     id={party.kycCase?.sofDocId} collapsed />
      </section>
      <div className="flex flex-col gap-6">
        <IdvChecklist partyId={party.id} kycCaseStatus={party.kycCase?.idvStatus ?? "pending"} />
        <ScreeningPanel partyId={party.id} latest={party.kycCase?.latestScreeningRun ?? null} />
      </div>
    </div>
  );
}

function DocSlot({ label, id, collapsed }: { label: string; id: string | null | undefined; collapsed?: boolean }) {
  if (!id) {
    return <div className="border border-dashed border-admin-border rounded-elem p-4 mb-3 text-meta text-admin-muted">{label}: not uploaded</div>;
  }
  return (
    <details open={!collapsed} className="border border-admin-border rounded-elem p-2 mb-3">
      <summary className="cursor-pointer text-meta font-semibold">{label}</summary>
      <iframe src={`/app/documents/${id}`} className="w-full h-[480px] mt-2 bg-admin-bg" />
    </details>
  );
}
```

`src/components/compliance/IdvChecklist.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ITEMS = [
  "Face matches photo on doc",
  "Document not expired",
  "Name matches party record",
  "DOB matches party record",
  "Document appears authentic (no obvious tampering)",
  "Proof of address is recent (< 3 months)",
  "Address on POA matches party record",
];

export function IdvChecklist({ partyId, kycCaseStatus }: { partyId: string; kycCaseStatus: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ticks, setTicks] = useState<boolean[]>(ITEMS.map(() => false));
  const [note, setNote] = useState("");

  function patch(status: "verified" | "failed") {
    if (status === "failed" && !note) { alert("A reason is required to mark as failed."); return; }
    start(async () => {
      const res = await fetch(`/api/admin/compliance/parties/${partyId}/kyc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idvStatus: status, idvNote: note || null }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-4">
      <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Identity verification</h3>
      <div className="text-meta mb-3">Current: <span className="badge badge-pending capitalize">{kycCaseStatus}</span></div>
      <ul className="flex flex-col gap-2 mb-3">
        {ITEMS.map((it, i) => (
          <li key={it}>
            <label className="flex gap-2 items-center text-meta">
              <input type="checkbox" checked={ticks[i]} onChange={(e) => { const c = [...ticks]; c[i] = e.target.checked; setTicks(c); }} /> {it}
            </label>
          </li>
        ))}
      </ul>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes (required for failure)" className="input w-full" rows={2} />
      <div className="flex gap-2 mt-3">
        <button type="button" disabled={pending || !ticks.every(Boolean)} onClick={() => patch("verified")} className="btn btn-primary px-4 py-2 disabled:opacity-50">Mark verified</button>
        <button type="button" disabled={pending} onClick={() => patch("failed")} className="btn px-4 py-2 text-[#DC2626]">Mark failed</button>
      </div>
    </section>
  );
}
```

`src/components/compliance/ScreeningPanel.tsx` + `HitRow.tsx`:
```tsx
// ScreeningPanel.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HitRow } from "./HitRow";

export function ScreeningPanel({ partyId, latest }: {
  partyId: string;
  latest: null | { id: string; outcome: string; ranAt: string; hits: { id: string; matchedName: string; matchedTopics: string[]; matchScore: number; reviewStatus: string; matchUrl: string | null }[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    start(async () => {
      await fetch(`/api/admin/compliance/parties/${partyId}/screen`, { method: "POST" });
      router.refresh();
    });
  }
  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted">Screening</h3>
        <button type="button" onClick={run} disabled={pending} className="btn px-3 py-1.5 text-meta">Run screening</button>
      </div>
      {!latest ? <p className="text-meta text-admin-muted">No screening yet.</p> : (
        <>
          <p className="text-meta mb-2">Latest: <span className="badge badge-pending">{latest.outcome}</span> at {new Date(latest.ranAt).toLocaleString()}</p>
          {latest.hits.length === 0 ? <p className="text-meta text-admin-muted">No hits.</p> : (
            <ul className="flex flex-col gap-2">{latest.hits.map((h) => <HitRow key={h.id} hit={h} />)}</ul>
          )}
        </>
      )}
    </section>
  );
}
```
```tsx
// HitRow.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function HitRow({ hit }: { hit: { id: string; matchedName: string; matchedTopics: string[]; matchScore: number; reviewStatus: string; matchUrl: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  function review(next: "false_positive" | "confirmed_match" | "escalated") {
    if ((next === "confirmed_match" || next === "escalated") && !note) {
      alert("A note is required to confirm or escalate a hit.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/admin/compliance/hits/${hit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: next, note: note || null }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }
  return (
    <li className="border border-admin-border rounded-elem p-3 flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <div>
          <div className="font-semibold text-meta">{hit.matchedName}</div>
          <div className="text-[11px] text-admin-muted">topics: {hit.matchedTopics.join(", ") || "—"} · score {hit.matchScore.toFixed(2)} · {hit.reviewStatus}</div>
        </div>
        {hit.matchUrl && <a href={hit.matchUrl} target="_blank" rel="noreferrer" className="text-[12px] underline">Open on OpenSanctions</a>}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note" className="input" />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => review("false_positive")} className="btn px-3 py-1.5 text-[12px]">False positive</button>
        <button type="button" disabled={pending} onClick={() => review("confirmed_match")} className="btn px-3 py-1.5 text-[12px] text-[#DC2626]">Confirm match</button>
        <button type="button" disabled={pending} onClick={() => review("escalated")} className="btn px-3 py-1.5 text-[12px]">Escalate</button>
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Per-party page**

`src/app/admin/clients/[id]/compliance/parties/[partyId]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { PartyWorkspace } from "@/components/compliance/PartyWorkspace";

export const dynamic = "force-dynamic";

export default async function PartyPage({ params }: { params: Promise<{ id: string; partyId: string }> }) {
  await requireRole("staff");
  const { partyId } = await params;
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      kycCase: { include: { latestScreeningRun: { include: { hits: true } } } },
    },
  });
  if (!party) notFound();
  return (
    <AdminShell active="clients">
      <div className="mb-6">
        <h1 className="font-display text-2xl">{party.fullName}</h1>
        <p className="text-meta text-admin-muted capitalize">{party.role.replace("_", " ")} · {party.type}</p>
      </div>
      <PartyWorkspace party={{
        id: party.id, fullName: party.fullName, role: party.role, type: party.type,
        kycCase: party.kycCase ? {
          id: party.kycCase.id,
          idvStatus: party.kycCase.idvStatus,
          passportDocId: party.kycCase.passportDocId,
          proofOfAddressDocId: party.kycCase.proofOfAddressDocId,
          sofDocId: party.kycCase.sofDocId,
          latestScreeningRun: party.kycCase.latestScreeningRun ? {
            id: party.kycCase.latestScreeningRun.id,
            outcome: party.kycCase.latestScreeningRun.outcome,
            ranAt: party.kycCase.latestScreeningRun.ranAt.toISOString(),
            hits: party.kycCase.latestScreeningRun.hits.map((h) => ({
              id: h.id, matchedName: h.matchedName, matchedTopics: h.matchedTopics,
              matchScore: h.matchScore, reviewStatus: h.reviewStatus, matchUrl: h.matchUrl,
            })),
          } : null,
        } : null,
      }} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Submission-side compliance page (reuses dashboard)**

`src/app/admin/submissions/[ref]/compliance/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";
import { recomputeAndStoreRisk } from "@/lib/services/compliance/risk-persist";

export const dynamic = "force-dynamic";

export default async function SubmissionCompliancePage({ params }: { params: Promise<{ ref: string }> }) {
  await requireRole("staff");
  const { ref } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { OR: [{ id: ref }, { referenceNumber: ref }] },
    include: { complianceFile: { include: {
      parties: { include: { kycCase: { include: { latestScreeningRun: { include: { hits: true } } } } } },
      reviewTasks: { where: { state: "open" }, include: { assignedTo: true } },
    } } },
  });
  if (!prospect?.complianceFile) notFound();
  if (!prospect.complianceFile.riskComputed) await recomputeAndStoreRisk(prospect.complianceFile.id, null);
  const file: any = prospect.complianceFile;
  return (
    <AdminShell active="submissions">
      <ComplianceDashboard file={{
        ...file,
        signedOffAt: file.signedOffAt?.toISOString() ?? null,
        parties: file.parties.map((p: any) => ({
          ...p,
          kycCase: p.kycCase ? {
            ...p.kycCase,
            latestScreeningRun: p.kycCase.latestScreeningRun ? {
              ...p.kycCase.latestScreeningRun,
              hits: p.kycCase.latestScreeningRun.hits.map((h: any) => ({
                id: h.id, matchedName: h.matchedName, matchedTopics: h.matchedTopics, reviewStatus: h.reviewStatus,
              })),
            } : null,
          } : null,
        })),
        reviewTasks: file.reviewTasks.map((t: any) => ({
          id: t.id, kind: t.kind, dueAt: t.dueAt?.toISOString() ?? null,
          assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
        })),
      }} parentLink={`/admin/submissions/${ref}/compliance`} />
    </AdminShell>
  );
}
```

- [ ] **Step 5: Cross-file task queue**

`src/app/admin/compliance/tasks/page.tsx`:
```tsx
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance tasks" };

export default async function TasksPage() {
  await requireRole("staff");
  const tasks = await prisma.reviewTask.findMany({
    where: { state: "open" },
    include: { complianceFile: { include: { client: true, prospect: true } } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return (
    <AdminShell active="compliance">
      <h1 className="font-display text-3xl mb-6">Compliance tasks</h1>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => {
          const link = t.complianceFile.clientId
            ? `/admin/clients/${t.complianceFile.clientId}/compliance`
            : `/admin/submissions/${t.complianceFile.prospect?.referenceNumber}/compliance`;
          return (
            <li key={t.id} className="border border-admin-border rounded-elem p-3 flex justify-between">
              <div>
                <span className="badge badge-pending mr-2">{t.kind.replace("_", " ")}</span>
                {t.dueAt && <span className="font-mono text-meta">due {new Date(t.dueAt).toLocaleDateString()}</span>}
              </div>
              <Link href={link} className="text-meta underline">Open</Link>
            </li>
          );
        })}
        {tasks.length === 0 && <p className="text-meta text-admin-muted">No open compliance tasks.</p>}
      </ul>
    </AdminShell>
  );
}
```

- [ ] **Step 6: Smoke + commit**

```bash
for u in /admin/compliance/tasks /admin/clients/X/compliance; do
  printf "%-50s -> HTTP " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost$u"
done
```
Expected: 307 for unauthenticated.

```bash
git add src/app/admin src/components/compliance
git commit -m "feat(ui): compliance pages (file, party, submissions, tasks)"
```

---

### Task 23: ConvertModal compliance pill + gate surfacing

**Files:**
- Modify: `src/app/admin/clients/ConvertModal.tsx`

- [ ] **Step 1: Read the existing file** to understand its shape, then add a `compliance: 'cleared' | 'in_review' | 'blocked'` field to each `candidate` (server passes it down via `page.tsx` already fetching approved prospects — extend that fetch to `include: { complianceFile: { select: { status: true } } }`).

In `src/app/admin/clients/page.tsx`, where `approvedProspects` is fetched, add to the include:
```ts
include: { user: true, complianceFile: { select: { status: true } } },
```

Then in the `ConvertModal` props mapping:
```ts
candidates={approvedProspects.map((p) => ({
  prospectId: p.id,
  referenceNumber: p.referenceNumber,
  name: p.user.fullName,
  services: (Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : []),
  compliance: p.complianceFile?.status ?? "open",
}))}
```

- [ ] **Step 2: In `ConvertModal.tsx`**, accept the new field, render a pill per row, and disable when not cleared. Show a deep link "Open compliance" instead of the convert button when blocked/in_review.

- [ ] **Step 3: Smoke-test the convert flow + commit**

```bash
git add src/app/admin/clients/page.tsx src/app/admin/clients/ConvertModal.tsx
git commit -m "feat(ui): convert modal shows compliance status + gates conversion"
```

---

## Phase 8 — End-to-end smoke test

### Task 24: Full E2E smoke test

**Files:** none new

- [ ] **Step 1: Register a fresh prospect**, complete onboarding (upload passport + POA). Expect:
  - ComplianceFile auto-created (verify with the SQL from Task 10 Step 3).
  - The new submission appears at `/admin/submissions`.

- [ ] **Step 2: Log in as `staff@oro.local`**, open the new submission, navigate to `…/compliance`. Expect: main_contact party present, passport/POA linked.

- [ ] **Step 3: Open the main_contact party workspace, tick all IDV items, mark Verified.** Expect KycCase becomes `passed`.

- [ ] **Step 4: Run screening.** Expect a `ScreeningRun` row (`clear` or `hits`). For a deliberate hit, edit the party name to `"Vladimir Putin"`, save, re-screen — expect hits.

- [ ] **Step 5: Review every hit** (false positive / confirmed / escalated). For an unrealistic-but-useful test of the auto-block path, confirm a hit with `sanction` topic and observe ComplianceFile flip to `blocked`. Undo by deleting the ScreeningHit row in SQL if needed for the rest of the test.

- [ ] **Step 6: Recompute risk.** Expect computed rating + score in the panel. Confirm or override with a reason.

- [ ] **Step 7: Sign off** with a note. Expect status `cleared`.

- [ ] **Step 8: Convert to client** from `/admin/clients`. Expect success (gate satisfied).

- [ ] **Step 9: Try to convert another approved prospect that is not yet `cleared`.** Expect the convert button disabled / a 409 from the API.

- [ ] **Step 10: Verify the worker**: `docker compose ... logs --tail=20 worker` shows `[auto-rescreen]` and `[periodic-review]` tick lines once per their schedule (you can force a manual call by adding a temporary `autoRescreenTick().catch(...)` line at the top of `src/worker/index.ts` during testing, then revert).

- [ ] **Step 11: Run the full test suite + type-check**

```bash
npm test
npm run typecheck
```

Expected: all green.

- [ ] **Step 12: Final commit (if any fixes from smoke)**

```bash
git add -A
git commit -m "chore(compliance): post-smoke fixes from E2E walkthrough"
```

---

## Self-review (executed by plan author)

- **Spec coverage:**
  - §3 data model → Task 2 ✓
  - §4 OpenSanctions → Tasks 7–9 ✓
  - §5 risk scoring → Tasks 3–5, 12 ✓
  - §6 worker → Tasks 17–19 ✓
  - §7 UI → Tasks 20–22 ✓
  - §8 sign-off + gate + backfill → Tasks 13, 19, 23 ✓
  - §9 API surface → Tasks 14–16 ✓
  - §10 ActivityLog extensions → Task 11 ✓
  - §11 out-of-scope → respected
- **Placeholder scan:** No "TBD"/"add validation"/"similar to" shortcuts. The one acceptable forward reference is Task 7 noting Task 8 finishes the require chain.
- **Type consistency:** `KycCheckStatus`/`KycCaseState`/`RiskRating` names match across schema, services, components. `ScreeningHit` shape matches between provider, service, and UI. `compliance.risk_assessed` / `compliance.risk_overridden` action names match between Task 11 (declared) and Tasks 12 / route handlers (used).

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-24-kyc-aml-compliance.md`.
