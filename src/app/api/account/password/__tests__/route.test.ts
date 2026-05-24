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
// Controls whether argon2.verify returns true or false in the "wrong password" test.
const argon2State = vi.hoisted(() => ({ verifyResult: true }));

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/auth/guards", () => ({
  assertRole: async (..._allowed: string[]) => {
    if (!sessionState.user) throw new Error("UNAUTHENTICATED");
    if (!_allowed.includes(sessionState.user.role)) throw new Error("FORBIDDEN");
    return sessionState.user;
  },
}));
vi.mock("argon2", () => ({
  default: {
    verify: async (_hash: string, _plain: string) => argon2State.verifyResult,
    hash: async (_plain: string) => "new-hash",
    argon2id: 2,
  },
  verify: async (_hash: string, _plain: string) => argon2State.verifyResult,
  hash: async (_plain: string) => "new-hash",
  argon2id: 2,
}));

// Inject `db` (tx or top-level prisma) as the module prisma so service code sees seeded data.
async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/account/password/route");
}

afterEach(() => {
  sessionState.user = null;
  argon2State.verifyResult = true;
  vi.resetModules();
});

describe("account/password route", () => {
  it("unauth: throws (assertRole behavior)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      await expect(
        POST(makeReq({ method: "POST", body: { currentPassword: "old", newPassword: "new12345" } })),
      ).rejects.toThrow();
    });
  });

  it("wrong current password → 400", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      // Update user's passwordHash to a real non-null value so the route proceeds to argon2.verify
      await tx.user.update({ where: { id: client.userId }, data: { passwordHash: "real-hash" } });
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      argon2State.verifyResult = false; // simulate wrong password

      const { POST } = await loadRoute(tx);
      const res = await POST(makeReq({ method: "POST", body: { currentPassword: "wrongPass", newPassword: "newPass123" } }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/incorrect/i);
    });
  });

  it("valid change → 200, User.passwordHash differs from before", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const originalHash = "original-hash";
      await tx.user.update({ where: { id: client.userId }, data: { passwordHash: originalHash } });
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      argon2State.verifyResult = true; // correct password

      const { POST } = await loadRoute(tx);
      const res = await POST(makeReq({ method: "POST", body: { currentPassword: "oldPass", newPassword: "newPass123" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      // The mocked argon2.hash returns "new-hash" so the passwordHash should be updated
      const updatedUser = await tx.user.findUnique({ where: { id: user!.id } });
      expect(updatedUser?.passwordHash).not.toBe(originalHash);
      expect(updatedUser?.passwordHash).toBe("new-hash");
    });
  });
});
