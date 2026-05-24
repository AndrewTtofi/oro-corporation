import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { makeReq } from "@/test/route";
import crypto from "node:crypto";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/auth/guards", () => ({
  assertRole: async (..._allowed: string[]) => { throw new Error("UNAUTHENTICATED"); },
}));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async () => ({ ok: true }) }),
}));
vi.mock("argon2", () => ({
  default: { hash: async () => "new-hash", verify: async () => true, argon2id: 2 },
  hash: async () => "new-hash", verify: async () => true, argon2id: 2,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 9, resetIn: 600 }),
}));
vi.mock("@/lib/env", () => ({
  env: () => ({
    NODE_ENV: "production",
    APP_URL: "http://localhost",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "x".repeat(32),
    ENCRYPTION_KEY_B64: "x".repeat(44),
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: "/tmp/test",
    EMAIL_DRIVER: "console",
    SCREENING_DRIVER: "opensanctions",
    SCREENING_MATCH_THRESHOLD: 0.7,
    SEED_ON_BOOT: false,
  }),
  features: { googleOAuth: false, linkedinOAuth: false, whatsapp: false, resendEmail: false },
}));

async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/auth/reset/route");
}

afterEach(() => {
  vi.resetModules();
});

/** Generate a raw token and its SHA-256 hex hash — mirrors the service logic. */
function makeTokenPair() {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
}

describe("auth/reset route", () => {
  it("missing/bad token (not found in DB) → 400", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({
        method: "POST",
        body: { token: crypto.randomBytes(32).toString("base64url"), password: "NewP@ssw0rd" },
      }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeTruthy();
    });
  });

  it("schema validation failure (token too short) → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({
        method: "POST",
        body: { token: "short", password: "NewP@ssw0rd" },
      }));
      expect(res.status).toBe(422);
    });
  });

  it("expired token → 400", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { raw, hashed } = makeTokenPair();
      const user = await tx.user.create({
        data: {
          email: "resetexpired@example.com",
          fullName: "Reset User",
          role: "prospect",
          emailVerified: new Date(),
          passwordHash: "old-hash",
        },
      });
      await tx.passwordReset.create({
        data: {
          userId: user.id,
          token: hashed,
          // expired 1 hour ago
          expires: new Date(Date.now() - 60 * 60 * 1000),
        },
      });

      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({
        method: "POST",
        body: { token: raw, password: "NewP@ssw0rd" },
      }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/expired/i);
    });
  });

  it("valid token → 200, User.passwordHash updated, PasswordReset.usedAt set", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { raw, hashed } = makeTokenPair();
      const user = await tx.user.create({
        data: {
          email: "resetvalid@example.com",
          fullName: "Reset User",
          role: "prospect",
          emailVerified: new Date(),
          passwordHash: "old-hash",
        },
      });
      const resetRecord = await tx.passwordReset.create({
        data: {
          userId: user.id,
          token: hashed,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({
        method: "POST",
        body: { token: raw, password: "NewP@ssw0rd" },
      }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const updatedUser = await tx.user.findUnique({ where: { id: user.id } });
      expect(updatedUser!.passwordHash).not.toBe("old-hash");
      expect(updatedUser!.passwordHash).toBe("new-hash"); // mocked argon2.hash

      const updatedReset = await tx.passwordReset.findUnique({ where: { id: resetRecord.id } });
      expect(updatedReset!.usedAt).not.toBeNull();
    });
  });

  it("already-used token → 400", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { raw, hashed } = makeTokenPair();
      const user = await tx.user.create({
        data: {
          email: "resetused@example.com",
          fullName: "Reset User",
          role: "prospect",
          emailVerified: new Date(),
          passwordHash: "old-hash",
        },
      });
      await tx.passwordReset.create({
        data: {
          userId: user.id,
          token: hashed,
          expires: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(), // already consumed
        },
      });

      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({
        method: "POST",
        body: { token: raw, password: "NewP@ssw0rd" },
      }));
      expect(res.status).toBe(400);
    });
  });
});
