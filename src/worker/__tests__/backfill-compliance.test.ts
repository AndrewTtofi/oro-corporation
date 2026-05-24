import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createProspect, createClient } from "@/test/seed";

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

async function loadJob(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/worker/jobs/backfill-compliance");
}

describe("backfill-compliance worker", () => {
  it("backfills Prospect without a ComplianceFile", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      const prospect = await createProspect(tx);
      // Confirm no ComplianceFile exists
      const before = await tx.complianceFile.findUnique({ where: { prospectId: prospect.id } });
      expect(before).toBeNull();

      const { backfillCompliance } = await loadJob(tx);
      await backfillCompliance();

      const cf = await tx.complianceFile.findUnique({ where: { prospectId: prospect.id } });
      expect(cf).not.toBeNull();
      expect(cf?.status).toBe("open");

      const party = await tx.party.findFirst({ where: { complianceFileId: cf!.id } });
      expect(party).not.toBeNull();
      expect(party?.role).toBe("main_contact");

      const kyc = await tx.kycCase.findFirst({ where: { partyId: party!.id } });
      expect(kyc).not.toBeNull();
    });
  });

  it("backfills Client without a ComplianceFile by linking to existing prospect file", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      // Create a client; createClient also creates a prospect internally
      const client = await createClient(tx);
      const clientRow = await tx.client.findUniqueOrThrow({ where: { id: client.id }, include: { prospect: true } });
      const prospect = clientRow.prospect;

      // Create a compliance file for the prospect (no clientId yet)
      const prospectCf = await tx.complianceFile.create({
        data: { prospectId: prospect.id, status: "open" },
      });
      expect(prospectCf.clientId).toBeNull();

      const { backfillCompliance } = await loadJob(tx);
      await backfillCompliance();

      // The existing file should now have clientId set
      const updatedCf = await tx.complianceFile.findUniqueOrThrow({ where: { id: prospectCf.id } });
      expect(updatedCf.clientId).toBe(client.id);

      // No new ComplianceFile should have been created for the client
      const allCfs = await tx.complianceFile.findMany({ where: { prospectId: prospect.id } });
      expect(allCfs).toHaveLength(1);
    });
  });

  it("is idempotent — running backfill twice does not create extra rows", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);

      const prospect = await createProspect(tx);

      // First run
      const { backfillCompliance: run1 } = await loadJob(tx);
      await run1();
      vi.resetModules();

      const cfCountAfterFirst = await tx.complianceFile.count({ where: { prospectId: prospect.id } });
      const cf = await tx.complianceFile.findUniqueOrThrow({ where: { prospectId: prospect.id } });
      const partyCountAfterFirst = await tx.party.count({ where: { complianceFileId: cf.id } });
      const party = await tx.party.findFirstOrThrow({ where: { complianceFileId: cf.id } });
      const kycCountAfterFirst = await tx.kycCase.count({ where: { partyId: party.id } });

      // Second run
      const { backfillCompliance: run2 } = await loadJob(tx);
      await run2();

      const cfCountAfterSecond = await tx.complianceFile.count({ where: { prospectId: prospect.id } });
      const partyCountAfterSecond = await tx.party.count({ where: { complianceFileId: cf.id } });
      const kycCountAfterSecond = await tx.kycCase.count({ where: { partyId: party.id } });

      expect(cfCountAfterSecond).toBe(cfCountAfterFirst);
      expect(partyCountAfterSecond).toBe(partyCountAfterFirst);
      expect(kycCountAfterSecond).toBe(kycCountAfterFirst);
    });
  });
});
