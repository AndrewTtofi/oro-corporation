import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createClient, createComplianceFile, createParty, createKycCase } from "@/test/seed";
import type { ScreeningResult } from "@/lib/providers/screening";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async () => ({ ok: true }) }),
}));
vi.mock("@/lib/env", () => ({
  env: () => ({ APP_URL: "http://localhost:3000" }),
}));

afterEach(() => {
  vi.resetModules();
});

async function loadJob(db: PrismaClient, providerResult: ScreeningResult) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  const screening = await import("@/lib/providers/screening");
  screening.__setScreeningProviderForTests({
    name: "stub",
    match: async () => providerResult,
  });
  return import("@/worker/jobs/auto-rescreen");
}

describe("auto-rescreen worker", () => {
  it("creates a screening_hit ReviewTask when new hit appears in re-screening", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      const client = await createClient(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: (await tx.client.findUniqueOrThrow({ where: { id: client.id }, include: { prospect: true } })).prospectId,
        status: "cleared",
        riskRating: "high",
      });
      const party = await createParty(tx, { complianceFileId: cf.id, role: "main_contact" });
      const kyc = await createKycCase(tx, { partyId: party.id, state: "passed" });

      // Seed old screening run (400 days ago, outcome=clear, no hits).
      // NOTE: The initial broad-filter in autoRescreenTick uses cutoff(365) —
      // only runs older than 365 days pass the initial query regardless of risk
      // band. This is a known bug (see CONCERNS in test report). To test the
      // happy path we seed the run as 400 days old so it clears the filter.
      const oldRun = await tx.screeningRun.create({
        data: {
          kycCaseId: kyc.id,
          provider: "stub",
          query: {},
          outcome: "clear",
          hitCount: 0,
          ranAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.kycCase.update({ where: { id: kyc.id }, data: { latestScreeningRunId: oldRun.id } });

      // Stub provider returns a new hit
      const hitResult: ScreeningResult = {
        outcome: "hits",
        hits: [{
          externalId: "ext-new-1",
          matchedName: party.fullName,
          matchedSchema: "Person",
          matchedTopics: ["sanction"],
          matchScore: 0.95,
          matchedListings: {},
        }],
        raw: {},
      };

      const { autoRescreenTick } = await loadJob(tx, hitResult);
      await autoRescreenTick();

      const task = await tx.reviewTask.findFirst({
        where: { complianceFileId: cf.id, kind: "screening_hit", state: "open" },
      });
      expect(task).not.toBeNull();
      expect(task?.kind).toBe("screening_hit");
    });
  });

  it("does not create duplicate task when run twice with same hit", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      const client = await createClient(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: (await tx.client.findUniqueOrThrow({ where: { id: client.id }, include: { prospect: true } })).prospectId,
        status: "cleared",
        riskRating: "high",
      });
      const party = await createParty(tx, { complianceFileId: cf.id, role: "main_contact" });
      const kyc = await createKycCase(tx, { partyId: party.id, state: "passed" });

      // Same note as test 1: must be > 365d old to pass the broad filter
      const oldRun = await tx.screeningRun.create({
        data: {
          kycCaseId: kyc.id,
          provider: "stub",
          query: {},
          outcome: "clear",
          hitCount: 0,
          ranAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.kycCase.update({ where: { id: kyc.id }, data: { latestScreeningRunId: oldRun.id } });

      const hitResult: ScreeningResult = {
        outcome: "hits",
        hits: [{
          externalId: "ext-dup-1",
          matchedName: party.fullName,
          matchedSchema: "Person",
          matchedTopics: ["sanction"],
          matchScore: 0.9,
          matchedListings: {},
        }],
        raw: {},
      };

      // First tick
      const { autoRescreenTick: tick1 } = await loadJob(tx, hitResult);
      await tick1();
      vi.resetModules();

      // Second tick — same hit, open task already exists
      const { autoRescreenTick: tick2 } = await loadJob(tx, hitResult);
      await tick2();

      const tasks = await tx.reviewTask.findMany({
        where: { complianceFileId: cf.id, kind: "screening_hit", state: "open" },
      });
      expect(tasks).toHaveLength(1);
    });
  });

  it("skips cases inside the cadence window", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      const client = await createClient(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: (await tx.client.findUniqueOrThrow({ where: { id: client.id }, include: { prospect: true } })).prospectId,
        status: "cleared",
        riskRating: "low", // cadence = 365d
      });
      const party = await createParty(tx, { complianceFileId: cf.id, role: "main_contact" });
      const kyc = await createKycCase(tx, { partyId: party.id, state: "passed" });

      // Latest run only 30 days ago — within the 365d window for low risk
      const recentRun = await tx.screeningRun.create({
        data: {
          kycCaseId: kyc.id,
          provider: "stub",
          query: {},
          outcome: "clear",
          hitCount: 0,
          ranAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.kycCase.update({ where: { id: kyc.id }, data: { latestScreeningRunId: recentRun.id } });

      const matchSpy = vi.fn().mockResolvedValue({ outcome: "clear", hits: [], raw: {} });
      const { autoRescreenTick } = await loadJob(tx, { outcome: "clear", hits: [], raw: {} });
      // Override the stub after loadJob to spy on provider calls
      const screeningMod = await import("@/lib/providers/screening");
      screeningMod.__setScreeningProviderForTests({ name: "spy-stub", match: matchSpy });

      await autoRescreenTick();

      expect(matchSpy).not.toHaveBeenCalled();
      const tasks = await tx.reviewTask.findMany({ where: { complianceFileId: cf.id } });
      expect(tasks).toHaveLength(0);
    });
  });

  it("skips when ComplianceFile is not cleared", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      const client = await createClient(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: (await tx.client.findUniqueOrThrow({ where: { id: client.id }, include: { prospect: true } })).prospectId,
        status: "in_review", // Not cleared — should be skipped
        riskRating: "high",
      });
      const party = await createParty(tx, { complianceFileId: cf.id, role: "main_contact" });
      const kyc = await createKycCase(tx, { partyId: party.id, state: "passed" });

      const matchSpy = vi.fn().mockResolvedValue({ outcome: "hits", hits: [], raw: {} });

      const { autoRescreenTick } = await loadJob(tx, { outcome: "hits", hits: [], raw: {} });
      const screeningMod = await import("@/lib/providers/screening");
      screeningMod.__setScreeningProviderForTests({ name: "spy-stub", match: matchSpy });

      await autoRescreenTick();

      expect(matchSpy).not.toHaveBeenCalled();
      const tasks = await tx.reviewTask.findMany({ where: { complianceFileId: cf.id } });
      expect(tasks).toHaveLength(0);
    });
  });
});
