import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx } from "@/test/tx";
import { createProspect, createComplianceFile } from "@/test/seed";

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
  return import("@/worker/jobs/periodic-review");
}

describe("periodic-review worker", () => {
  it("creates a periodic_review task when cleared file has no prior review", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      // periodic-review doesn't use $transaction internally, plain tx is fine
      const tx = rawTx as unknown as PrismaClient;

      const prospect = await createProspect(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: prospect.id,
        status: "cleared",
        riskRating: "standard",
      });

      const { periodicReviewTick } = await loadJob(tx);
      await periodicReviewTick();

      const task = await tx.reviewTask.findFirst({
        where: { complianceFileId: cf.id, kind: "periodic_review", state: "open" },
      });
      expect(task).not.toBeNull();
      expect(task?.kind).toBe("periodic_review");
    });
  });

  it("skips when an open periodic_review already exists", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = rawTx as unknown as PrismaClient;

      const prospect = await createProspect(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: prospect.id,
        status: "cleared",
        riskRating: "standard",
      });

      // Pre-create an open task
      await tx.reviewTask.create({
        data: {
          complianceFileId: cf.id,
          kind: "periodic_review",
          dueAt: new Date(Date.now() + 14 * 86400000),
        },
      });

      const { periodicReviewTick } = await loadJob(tx);
      await periodicReviewTick();

      const tasks = await tx.reviewTask.findMany({
        where: { complianceFileId: cf.id, kind: "periodic_review" },
      });
      expect(tasks).toHaveLength(1);
    });
  });

  it("skips when a completed periodic_review is within cadence (30d ago, standard=365d)", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = rawTx as unknown as PrismaClient;

      const prospect = await createProspect(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: prospect.id,
        status: "cleared",
        riskRating: "standard", // cadence = 365d
      });

      // Completed task only 30 days ago — within cadence
      await tx.reviewTask.create({
        data: {
          complianceFileId: cf.id,
          kind: "periodic_review",
          state: "completed",
          dueAt: new Date(Date.now() - 30 * 86400000),
          completedAt: new Date(Date.now() - 30 * 86400000),
        },
      });

      const { periodicReviewTick } = await loadJob(tx);
      await periodicReviewTick();

      const tasks = await tx.reviewTask.findMany({
        where: { complianceFileId: cf.id, kind: "periodic_review", state: "open" },
      });
      expect(tasks).toHaveLength(0);
    });
  });

  it("creates new task when last completed review exceeded cadence (400d ago, standard=365d)", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = rawTx as unknown as PrismaClient;

      const prospect = await createProspect(tx);
      const cf = await createComplianceFile(tx, {
        prospectId: prospect.id,
        status: "cleared",
        riskRating: "standard", // cadence = 365d
      });

      // Completed task 400 days ago — exceeds cadence
      await tx.reviewTask.create({
        data: {
          complianceFileId: cf.id,
          kind: "periodic_review",
          state: "completed",
          dueAt: new Date(Date.now() - 400 * 86400000),
          completedAt: new Date(Date.now() - 400 * 86400000),
        },
      });

      const { periodicReviewTick } = await loadJob(tx);
      await periodicReviewTick();

      const openTasks = await tx.reviewTask.findMany({
        where: { complianceFileId: cf.id, kind: "periodic_review", state: "open" },
      });
      expect(openTasks).toHaveLength(1);
    });
  });
});
