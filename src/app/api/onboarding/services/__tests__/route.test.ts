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

async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/onboarding/services/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

describe("onboarding/services POST route", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      await expect(POST(makeReq({ method: "POST", body: { services: ["accounting"] } }))).rejects.toThrow();
    });
  });

  it("empty services array → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { services: [] } }));
      expect(res.status).toBe(422);
    });
  });

  it("invalid service key → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { services: ["invalid_service"] } }));
      expect(res.status).toBe(422);
    });
  });

  it("missing services field → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: {} }));
      expect(res.status).toBe(422);
    });
  });

  it("valid services for new user → 200, Prospect created + servicesSelected set", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { services: ["accounting", "tax_residency"] } }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      // Prospect row must exist with services saved
      const prospect = await tx.prospect.findUnique({ where: { userId: user.id } });
      expect(prospect).not.toBeNull();
      expect(prospect!.servicesSelected).toContain("accounting");
      expect(prospect!.servicesSelected).toContain("tax_residency");
    });
  });

  it("valid services for existing prospect → 200, servicesSelected updated", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: { services: ["company_formation", "banking"] } }));
      expect(res.status).toBe(200);
      const prospect = await tx.prospect.findUnique({ where: { userId: user.id } });
      expect(prospect!.servicesSelected).toContain("company_formation");
      expect(prospect!.servicesSelected).toContain("banking");
    });
  });
});
