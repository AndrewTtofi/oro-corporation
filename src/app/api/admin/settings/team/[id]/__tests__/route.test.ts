import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createStaff, createPartner } from "@/test/seed";
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
  return import("@/app/api/admin/settings/team/[id]/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

describe("admin/settings/team/[id] PATCH", () => {
  it("unauth: throws", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      sessionState.user = null;
      const { PATCH } = await loadRoute(tx);
      await expect(
        PATCH(makeReq({ method: "PATCH", body: { deactivated: true } }), makeParams({ id: "any-id" }))
      ).rejects.toThrow();
    });
  });

  it("wrong role (client): throws FORBIDDEN", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      sessionState.user = { id: "u1", email: "c@test.local", fullName: "Client", role: "client" };
      const { PATCH } = await loadRoute(tx);
      await expect(
        PATCH(makeReq({ method: "PATCH", body: { deactivated: true } }), makeParams({ id: "any-id" }))
      ).rejects.toThrow("FORBIDDEN");
    });
  });

  it("bad input (extra field on strict schema) → 422", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      const target = await createStaff(tx);
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { PATCH } = await loadRoute(tx);
      const res = await PATCH(
        makeReq({ method: "PATCH", body: { unknownField: "bad" } }),
        makeParams({ id: target.id })
      );
      expect(res.status).toBe(422);
    });
  });

  it("self-modification → 400", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { PATCH } = await loadRoute(tx);
      const res = await PATCH(
        makeReq({ method: "PATCH", body: { deactivated: true } }),
        makeParams({ id: actor.id })
      );
      expect(res.status).toBe(400);
    });
  });

  it("not found → 404", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { PATCH } = await loadRoute(tx);
      const res = await PATCH(
        makeReq({ method: "PATCH", body: { deactivated: true } }),
        makeParams({ id: "00000000-0000-0000-0000-000000000000" })
      );
      expect(res.status).toBe(404);
    });
  });

  it("deactivate: sets deactivatedAt → 200", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      const target = await createStaff(tx);
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { PATCH } = await loadRoute(tx);
      const res = await PATCH(
        makeReq({ method: "PATCH", body: { deactivated: true } }),
        makeParams({ id: target.id })
      );
      expect(res.status).toBe(200);
      const updated = await tx.user.findUnique({ where: { id: target.id } });
      expect(updated?.deactivatedAt).not.toBeNull();
    });
  });

  it("reactivate: clears deactivatedAt → 200", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      // Create a partner that's pre-deactivated
      const target = await createPartner(tx);
      await tx.user.update({ where: { id: target.id }, data: { deactivatedAt: new Date() } });
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { PATCH } = await loadRoute(tx);
      const res = await PATCH(
        makeReq({ method: "PATCH", body: { deactivated: false } }),
        makeParams({ id: target.id })
      );
      expect(res.status).toBe(200);
      const updated = await tx.user.findUnique({ where: { id: target.id } });
      expect(updated?.deactivatedAt).toBeNull();
    });
  });

  it("change role: staff → partner → 200", async () => {
    await inRollbackTx(prisma, async (rawTx) => {
      const tx = wrapTx(rawTx);
      const actor = await createStaff(tx);
      const target = await createStaff(tx);
      sessionState.user = { id: actor.id, email: actor.email, fullName: actor.fullName, role: "staff" };
      const { PATCH } = await loadRoute(tx);
      const res = await PATCH(
        makeReq({ method: "PATCH", body: { role: "partner" } }),
        makeParams({ id: target.id })
      );
      expect(res.status).toBe(200);
      const updated = await tx.user.findUnique({ where: { id: target.id } });
      expect(updated?.role).toBe("partner");
    });
  });
});
