import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createStaff, createPartner, createProspect, createUser } from "@/test/seed";
import { makeReq, makeParams } from "@/test/route";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

const sessionState = vi.hoisted(() => ({ user: null as null | { id: string; email: string; fullName: string; role: string } }));

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/auth/guards", () => ({
  assertRole: async (..._allowed: string[]) => {
    if (!sessionState.user) throw new Error("UNAUTHENTICATED");
    if (!_allowed.includes(sessionState.user.role)) throw new Error("FORBIDDEN");
    return sessionState.user;
  },
}));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async () => ({ ok: true }) }),
}));

async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/admin/submissions/[id]/assign-partner/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

describe("admin/submissions/[id]/assign-partner POST", () => {
  it("unauth: throws", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      await expect(
        POST(makeReq({ method: "POST", body: { partnerId: null } }), makeParams({ id: "any-id" }))
      ).rejects.toThrow();
    });
  });

  it("wrong role (client): throws FORBIDDEN", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      sessionState.user = { id: "u1", email: "c@test.local", fullName: "Client", role: "client" };
      const { POST } = await loadRoute(tx);
      await expect(
        POST(makeReq({ method: "POST", body: { partnerId: null } }), makeParams({ id: "any-id" }))
      ).rejects.toThrow("FORBIDDEN");
    });
  });

  it("bad input (non-uuid partnerId) → 422", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const staff = await createStaff(tx);
      const prospect = await createProspect(tx);
      sessionState.user = { id: staff.id, email: staff.email, fullName: staff.fullName, role: "staff" };
      const { POST } = await loadRoute(tx);
      const res = await POST(
        makeReq({ method: "POST", body: { partnerId: "not-a-uuid" } }),
        makeParams({ id: prospect.id })
      );
      expect(res.status).toBe(422);
    });
  });

  it("prospect not found → 404", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const staff = await createStaff(tx);
      sessionState.user = { id: staff.id, email: staff.email, fullName: staff.fullName, role: "staff" };
      const { POST } = await loadRoute(tx);
      const res = await POST(
        makeReq({ method: "POST", body: { partnerId: null } }),
        makeParams({ id: "00000000-0000-0000-0000-000000000000" })
      );
      expect(res.status).toBe(404);
    });
  });

  it("happy path: assigns partner → 200, draft updated", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const staff = await createStaff(tx);
      const partner = await createPartner(tx);
      const prospect = await createProspect(tx);
      sessionState.user = { id: staff.id, email: staff.email, fullName: staff.fullName, role: "staff" };
      const { POST } = await loadRoute(tx);
      const res = await POST(
        makeReq({ method: "POST", body: { partnerId: partner.id } }),
        makeParams({ id: prospect.id })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      const updated = await tx.prospect.findUnique({ where: { id: prospect.id } });
      const draft = updated?.draft as Record<string, unknown> | null;
      expect(draft?.__assignedPartnerId).toBe(partner.id);
    });
  });

  it("happy path: clears partner assignment (null) → 200", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const staff = await createStaff(tx);
      const partner = await createPartner(tx);
      // Pre-assign a partner
      const prospect = await createProspect(tx);
      await tx.prospect.update({
        where: { id: prospect.id },
        data: { draft: { __assignedPartnerId: partner.id } },
      });
      sessionState.user = { id: staff.id, email: staff.email, fullName: staff.fullName, role: "staff" };
      const { POST } = await loadRoute(tx);
      const res = await POST(
        makeReq({ method: "POST", body: { partnerId: null } }),
        makeParams({ id: prospect.id })
      );
      expect(res.status).toBe(200);
      const updated = await tx.prospect.findUnique({ where: { id: prospect.id } });
      const draft = updated?.draft as Record<string, unknown> | null;
      expect(draft?.__assignedPartnerId).toBeNull();
    });
  });

  /**
   * CONCERN: The route does NOT validate that the target user has role=partner.
   * Any valid UUID (including a staff user) can be assigned as a partner.
   * This test documents the current (permissive) behavior.
   * A production-hardening fix would add: if (partner.role !== 'partner') return 400.
   */
  it("concern: non-partner user id is accepted without role check → 200", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      const nonPartner = await createUser(tx, { role: "staff" });
      const prospect = await createProspect(tx);
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { POST } = await loadRoute(tx);
      const res = await POST(
        makeReq({ method: "POST", body: { partnerId: nonPartner.id } }),
        makeParams({ id: prospect.id })
      );
      // Documents current behavior: no role validation → 200
      expect(res.status).toBe(200);
    });
  });
});
