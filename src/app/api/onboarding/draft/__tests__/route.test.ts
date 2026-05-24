import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createUser, createProspect } from "@/test/seed";
import { makeReq } from "@/test/route";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

const sessionState = vi.hoisted(() => ({ user: null as null | { id: string; email: string; fullName: string; role: string } }));

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/auth/guards", () => ({
  assertRole: async (...allowed: string[]) => {
    if (!sessionState.user) throw new Error("UNAUTHENTICATED");
    if (!allowed.includes(sessionState.user.role)) throw new Error("FORBIDDEN");
    return sessionState.user;
  },
  requireUser: async () => {
    if (!sessionState.user) throw new Error("UNAUTHENTICATED");
    return sessionState.user;
  },
  requireRole: async (...allowed: string[]) => {
    if (!sessionState.user) throw new Error("UNAUTHENTICATED");
    if (!allowed.includes(sessionState.user.role)) throw new Error("FORBIDDEN");
    return sessionState.user;
  },
}));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async () => ({ ok: true }) }),
}));
vi.mock("@/lib/providers/storage", () => ({
  storage: () => ({
    put: async (key: string, _buf: Buffer, _mime: string) => ({
      key,
      encMeta: { alg: "aes-256-gcm", ivB64: "AAAAAAAAAAAAAAAA", tagB64: "AAAAAAAAAAAAAAAAAAAAAA==", keyId: "test" },
      sizeBytes: _buf.byteLength,
    }),
    getStream: async (_key: string, _encMeta: unknown) => {
      const { Readable } = await import("node:stream");
      const stream = new Readable({ read() {} });
      stream.push(null);
      return stream;
    },
    delete: async (_key: string) => { /* no-op */ },
  }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 59, resetIn: 60 }),
}));

async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/onboarding/draft/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

/** A valid partial draft body (no required fields at draft stage). */
const validDraftBody = {
  fullLegalName: "Jane Doe",
  nationality: "US",
  residenceCountry: "CY",
  services: ["accounting"],
};

describe("onboarding/draft POST route", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      await expect(POST(makeReq({ method: "POST", body: validDraftBody }))).rejects.toThrow();
    });
  });

  it("body with wrong field types → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      // dateOfBirth must be a date-parseable value; passing a nonsense string
      const res = await POST(makeReq({ method: "POST", body: { dateOfBirth: "not-a-date-at-all-xyz" } }));
      expect(res.status).toBe(422);
    });
  });

  it("valid partial draft for new user → 200, Prospect.draft saved", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: validDraftBody }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      const prospect = await tx.prospect.findUnique({ where: { userId: user.id } });
      expect(prospect).not.toBeNull();
      const draft = prospect!.draft as Record<string, unknown>;
      expect(draft.fullLegalName).toBe("Jane Doe");
    });
  });

  it("valid partial draft for existing prospect → 200, draft merged", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { fullLegalName: "Updated Name", nationality: "GR" } }));
      expect(res.status).toBe(200);
      const prospect = await tx.prospect.findUnique({ where: { userId: user.id } });
      const draft = prospect!.draft as Record<string, unknown>;
      expect(draft.fullLegalName).toBe("Updated Name");
      expect(draft.nationality).toBe("GR");
    });
  });
});
