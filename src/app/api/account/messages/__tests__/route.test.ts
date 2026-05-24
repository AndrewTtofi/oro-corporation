import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx } from "@/test/tx";
import { createClient, createProspect } from "@/test/seed";
import { makeReq } from "@/test/route";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

// Shared session state read by the guards mock below.
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

// Inject `db` (tx or top-level prisma) as the module prisma so service code sees seeded data.
async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/account/messages/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

describe("account/messages route", () => {
  it("unauth: throws (assertRole behavior)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      await expect(POST(makeReq({ method: "POST", body: {} }))).rejects.toThrow();
    });
  });

  it("empty body → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(tx);
      const res = await POST(makeReq({ method: "POST", body: { body: "" } }));
      expect(res.status).toBe(422);
    });
  });

  it("client posts → 200, Message.clientId set", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(tx);
      const res = await POST(makeReq({ method: "POST", body: { body: "Hello from client" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.id).toBeTruthy();
      const msg = await tx.message.findUnique({ where: { id: json.id } });
      expect(msg?.clientId).toBe(client.id);
      expect(msg?.prospectId).toBeNull();
    });
  });

  it("prospect posts (no client linked) → 200, Message.prospectId set", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const prospect = await createProspect(tx);
      const user = await tx.user.findUnique({ where: { id: prospect.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "prospect" };
      const { POST } = await loadRoute(tx);
      const res = await POST(makeReq({ method: "POST", body: { body: "Hello from prospect" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.id).toBeTruthy();
      const msg = await tx.message.findUnique({ where: { id: json.id } });
      expect(msg?.prospectId).toBe(prospect.id);
      expect(msg?.clientId).toBeNull();
    });
  });
});
