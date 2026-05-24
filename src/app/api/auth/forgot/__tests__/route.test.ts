import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { makeReq } from "@/test/route";

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
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 4, resetIn: 600 }),
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
  return import("@/app/api/auth/forgot/route");
}

afterEach(() => {
  vi.resetModules();
});

describe("auth/forgot route", () => {
  it("unknown email → 200 (generic; no email leak)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { email: "nobody@example.com" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      // No PasswordReset row should be created for unknown email.
      const count = await tx.passwordReset.count();
      expect(count).toBe(0);
    });
  });

  it("known email → 200, PasswordReset row created", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await tx.user.create({
        data: {
          email: "known@example.com",
          fullName: "Known User",
          role: "prospect",
          emailVerified: new Date(),
          passwordHash: "x",
        },
      });

      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { email: "known@example.com" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const reset = await tx.passwordReset.findFirst({ where: { userId: user.id } });
      expect(reset).not.toBeNull();
      expect(reset!.token).toBeTruthy();
      expect(reset!.expires.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it("invalid email format → 200 (route is silent for all invalid input)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const { POST } = await loadRoute(wrapTx(tx));
      // The forgot route silently returns ok:true even for bad input to avoid leaking info.
      const res = await POST(makeReq({ method: "POST", body: { email: "not-an-email" } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });
});
