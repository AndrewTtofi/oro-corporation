import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx } from "@/test/tx";
import { createComplianceFile, createParty, createKycCase } from "@/test/seed";
import type { ScreeningProvider, ScreeningResult } from "@/lib/providers/screening";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));

async function loadService(db: PrismaClient, stub: ScreeningProvider) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  const screeningMod = await import("@/lib/providers/screening");
  screeningMod.__setScreeningProviderForTests(stub);
  return import("@/lib/services/compliance/screening");
}

afterEach(() => {
  vi.resetModules();
});

function makeProvider(result: ScreeningResult): ScreeningProvider {
  return { name: "stub", match: vi.fn().mockResolvedValue(result) };
}

describe("runScreening", () => {
  it("clear outcome → ScreeningRun created, KycCase.latestScreeningRunId set, no hits", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const compFile = await createComplianceFile(tx);
      const party = await createParty(tx, {
        complianceFileId: compFile.id,
        type: "individual",
        fullName: "Jane Test",
      });
      const kycCase = await createKycCase(tx, { partyId: party.id, state: "in_progress" });

      const stub = makeProvider({ outcome: "clear", hits: [], raw: {} });
      const { runScreening } = await loadService(tx, stub);

      const run = await runScreening(kycCase.id, { actorId: null });

      expect(run.outcome).toBe("clear");
      expect(run.kycCaseId).toBe(kycCase.id);

      const updatedCase = await tx.kycCase.findUnique({ where: { id: kycCase.id } });
      expect(updatedCase?.latestScreeningRunId).toBe(run.id);

      const hits = await tx.screeningHit.findMany({ where: { screeningRunId: run.id } });
      expect(hits).toHaveLength(0);
    });
  });

  it("hits outcome → ScreeningRun + ScreeningHit rows created", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const compFile = await createComplianceFile(tx);
      const party = await createParty(tx, {
        complianceFileId: compFile.id,
        type: "individual",
        fullName: "Joe Sanction",
      });
      const kycCase = await createKycCase(tx, { partyId: party.id, state: "in_progress" });

      const stub = makeProvider({
        outcome: "hits",
        hits: [{
          externalId: "NK-1",
          matchedName: "Joe Sanction",
          matchedSchema: "Person",
          matchedTopics: ["sanction"],
          matchScore: 0.9,
          matchedListings: [],
          matchUrl: "https://example.com/NK-1",
        }],
        raw: {},
      });
      const { runScreening } = await loadService(tx, stub);

      const run = await runScreening(kycCase.id, { actorId: null });

      expect(run.outcome).toBe("hits");
      expect(run.hitCount).toBe(1);

      const hits = await tx.screeningHit.findMany({ where: { screeningRunId: run.id } });
      expect(hits).toHaveLength(1);
      expect(hits[0].externalId).toBe("NK-1");
      expect(hits[0].matchedName).toBe("Joe Sanction");
    });
  });

  it("error outcome → ScreeningRun.outcome=error, KycCase.latestScreeningRunId unchanged", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const compFile = await createComplianceFile(tx);
      const party = await createParty(tx, {
        complianceFileId: compFile.id,
        type: "individual",
        fullName: "Joe Error",
      });
      const kycCase = await createKycCase(tx, { partyId: party.id, state: "passed" });

      const stub = makeProvider({ outcome: "error", hits: [], errorMessage: "boom" });
      const { runScreening } = await loadService(tx, stub);

      const run = await runScreening(kycCase.id, { actorId: null });

      expect(run.outcome).toBe("error");

      const updatedCase = await tx.kycCase.findUnique({ where: { id: kycCase.id } });
      // latestScreeningRunId must NOT be updated on error
      expect(updatedCase?.latestScreeningRunId).toBeNull();
      // state must remain unchanged
      expect(updatedCase?.state).toBe("passed");
    });
  });
});
