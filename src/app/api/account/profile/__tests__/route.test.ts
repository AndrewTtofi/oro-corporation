import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx } from "@/test/tx";
import { createClient } from "@/test/seed";
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

/**
 * Wrap a tx client so that $transaction calls pass through to the tx itself.
 * updateClientSelfProfile calls prisma.$transaction(async (innerTx) => {...}),
 * but interactive-transaction clients don't expose $transaction.
 * This shim delegates $transaction by simply calling the callback with the tx.
 */
function wrapTx(tx: PrismaClient): PrismaClient {
  return new Proxy(tx, {
    get(target, prop) {
      if (prop === "$transaction") {
        return (fn: (tx: PrismaClient) => Promise<unknown>) => fn(wrapTx(tx));
      }
      const val = (target as Record<string | symbol, unknown>)[prop];
      if (typeof val === "function") return val.bind(target);
      return val;
    },
  });
}

// Inject `db` into module so service code sees seeded data.
async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/account/profile/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

describe("account/profile route", () => {
  it("unauth: throws (assertRole behavior)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(wrapTx(tx));
      await expect(POST(makeReq({ method: "POST", body: {} }))).rejects.toThrow();
    });
  });

  it("unknown field (e.g. companyName) → 422 (strict schema rejects it)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { companyName: "Acme" } }));
      expect(res.status).toBe(422);
    });
  });

  it("update phone + languagePref → 200, User row updated", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { phone: "+1-555-0000", languagePref: "ru" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      const updatedUser = await tx.user.findUnique({ where: { id: user!.id } });
      expect(updatedUser?.phone).toBe("+1-555-0000");
      expect(updatedUser?.languagePref).toBe("ru");
    });
  });

  it("update address + taxResidency as a client → 200, Client row updated", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { address: "123 Main St", taxResidency: "US" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      const updatedClient = await tx.client.findUnique({ where: { id: client.id } });
      expect(updatedClient?.address).toBe("123 Main St");
      expect(updatedClient?.taxResidency).toBe("US");
    });
  });
});
