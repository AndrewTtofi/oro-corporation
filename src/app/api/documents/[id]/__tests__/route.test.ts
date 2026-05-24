import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createUser, createProspect } from "@/test/seed";
import { makeReq, makeParams } from "@/test/route";

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
      stream.push(Buffer.from("fake-pdf-bytes"));
      stream.push(null);
      return stream;
    },
    delete: async (_key: string) => { /* no-op */ },
  }),
}));

async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/documents/[id]/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

/** Helper to seed a Document row directly via tx. */
async function createDocument(
  tx: PrismaClient,
  prospectId: string,
  opts: { type?: string } = {},
) {
  return tx.document.create({
    data: {
      prospectId,
      type: (opts.type as "passport") ?? "passport",
      storageKey: `test/doc-${Date.now()}.pdf`,
      encMeta: { alg: "aes-256-gcm", ivB64: "AAAAAAAAAAAAAAAA", tagB64: "AAAAAAAAAAAAAAAAAAAAAA==", keyId: "test" } as never,
      originalName: "passport.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    },
  });
}

describe("documents/[id] GET route", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { GET } = await loadRoute(tx);
      await expect(
        GET(makeReq({ method: "GET" }), makeParams({ id: "does-not-matter" })),
      ).rejects.toThrow();
    });
  });

  it("doc not found → 404", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { GET } = await loadRoute(wrapTx(tx));
      const res = await GET(makeReq({ method: "GET" }), makeParams({ id: "nonexistent-id" }));
      expect(res.status).toBe(404);
    });
  });

  it("prospect owner reads their own doc → 200", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      const prospect = await createProspect(tx, { userId: user.id });
      const doc = await createDocument(tx, prospect.id);
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { GET } = await loadRoute(wrapTx(tx));
      const res = await GET(makeReq({ method: "GET" }), makeParams({ id: doc.id }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/pdf");
    });
  });

  it("staff reads any doc → 200", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const prospectUser = await createUser(tx, { role: "prospect" });
      const prospect = await createProspect(tx, { userId: prospectUser.id });
      const doc = await createDocument(tx, prospect.id);
      const staff = await createUser(tx, { role: "staff" });
      sessionState.user = { id: staff.id, email: staff.email, fullName: staff.fullName, role: "staff" };
      const { GET } = await loadRoute(wrapTx(tx));
      const res = await GET(makeReq({ method: "GET" }), makeParams({ id: doc.id }));
      expect(res.status).toBe(200);
    });
  });

  it("different prospect cannot read another's doc → 404", async () => {
    await inRollbackTx(prisma, async (tx) => {
      // Owner prospect + doc
      const ownerUser = await createUser(tx, { role: "prospect" });
      const ownerProspect = await createProspect(tx, { userId: ownerUser.id });
      const doc = await createDocument(tx, ownerProspect.id);
      // Attacker prospect
      const attackerUser = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: attackerUser.id, email: attackerUser.email, fullName: attackerUser.fullName, role: "prospect" };
      const { GET } = await loadRoute(wrapTx(tx));
      const res = await GET(makeReq({ method: "GET" }), makeParams({ id: doc.id }));
      expect(res.status).toBe(404);
    });
  });
});

describe("documents/[id] DELETE route", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { DELETE } = await loadRoute(tx);
      await expect(
        DELETE(makeReq({ method: "DELETE" }), makeParams({ id: "does-not-matter" })),
      ).rejects.toThrow();
    });
  });

  it("prospect deletes their own doc → 200, row removed", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      const prospect = await createProspect(tx, { userId: user.id });
      const doc = await createDocument(tx, prospect.id);
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { DELETE } = await loadRoute(wrapTx(tx));
      const res = await DELETE(makeReq({ method: "DELETE" }), makeParams({ id: doc.id }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      const gone = await tx.document.findUnique({ where: { id: doc.id } });
      expect(gone).toBeNull();
    });
  });

  it("different prospect cannot delete another's doc → 404", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const ownerUser = await createUser(tx, { role: "prospect" });
      const ownerProspect = await createProspect(tx, { userId: ownerUser.id });
      const doc = await createDocument(tx, ownerProspect.id);
      const attackerUser = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: attackerUser.id, email: attackerUser.email, fullName: attackerUser.fullName, role: "prospect" };
      const { DELETE } = await loadRoute(wrapTx(tx));
      const res = await DELETE(makeReq({ method: "DELETE" }), makeParams({ id: doc.id }));
      expect(res.status).toBe(404);
      // doc still exists
      const still = await tx.document.findUnique({ where: { id: doc.id } });
      expect(still).not.toBeNull();
    });
  });
});
