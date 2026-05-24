import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { makeReq } from "@/test/route";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

// Hoisted env state so the mock factory can read it.
const envState = vi.hoisted(() => ({
  NODE_ENV: "production" as "development" | "production" | "test",
}));

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/auth/guards", () => ({
  assertRole: async (..._allowed: string[]) => { throw new Error("UNAUTHENTICATED"); },
}));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async () => ({ ok: true }) }),
}));
vi.mock("argon2", () => ({
  default: { hash: async () => "hash", verify: async () => true, argon2id: 2 },
  hash: async () => "hash", verify: async () => true, argon2id: 2,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 4, resetIn: 600 }),
}));
vi.mock("@/lib/env", () => ({
  env: () => ({
    NODE_ENV: envState.NODE_ENV,
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
  return import("@/app/api/auth/register/route");
}

afterEach(() => {
  envState.NODE_ENV = "production";
  vi.resetModules();
});

const validBody = {
  fullName: "Alice Smith",
  email: "alice@example.com",
  phoneCountry: "+1",
  phoneNumber: "5551234567",
  password: "Passw0rd!",
};

describe("auth/register route", () => {
  it("missing required fields → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { email: "bad" } }));
      expect(res.status).toBe(422);
    });
  });

  it("duplicate email → 200 with generic message (no leak)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      // Seed a user with the same email.
      await tx.user.create({
        data: {
          email: validBody.email,
          fullName: "Existing User",
          role: "prospect",
          emailVerified: new Date(),
          passwordHash: "x",
        },
      });
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: validBody }));
      // Route returns 200 to avoid leaking email existence.
      expect(res.status).toBe(200);
      const json = await res.json();
      // No `ok: true` — body carries generic message, no user data.
      expect(json.ok).toBeUndefined();
      expect(json.error).toBeTruthy();
    });
  });

  it("new email, production → 200, User created with emailVerified: null, VerificationToken created", async () => {
    envState.NODE_ENV = "production";
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: validBody }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const user = await tx.user.findUnique({ where: { email: validBody.email } });
      expect(user).not.toBeNull();
      expect(user!.emailVerified).toBeNull();
      expect(user!.passwordHash).toBe("hash");

      const token = await tx.verificationToken.findFirst({ where: { userId: user!.id } });
      expect(token).not.toBeNull();
    });
  });

  it("new email, development → 200, User created with emailVerified set (auto-verify)", async () => {
    envState.NODE_ENV = "development";
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: validBody }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const user = await tx.user.findUnique({ where: { email: validBody.email } });
      expect(user).not.toBeNull();
      expect(user!.emailVerified).not.toBeNull();
    });
  });
});
