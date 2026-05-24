import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createUser, createProspect } from "@/test/seed";
import { makeReq } from "@/test/route";
import { MAX_BYTES } from "@/lib/services/documents";

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
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 29, resetIn: 600 }),
}));

async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/documents/upload/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

/** Build a valid multipart request with the given file and type field. */
function makeUploadReq(file: File, type: string): Request {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  return makeReq({ method: "POST", form });
}

describe("documents/upload POST route", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      const file = new File([new Uint8Array(100)], "x.pdf", { type: "application/pdf" });
      await expect(POST(makeUploadReq(file, "passport"))).rejects.toThrow();
    });
  });

  it("non-multipart content-type → 415", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      // JSON body triggers the CT check
      const res = await POST(makeReq({ method: "POST", body: { type: "passport" } }));
      expect(res.status).toBe(415);
    });
  });

  it("invalid doc type → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const file = new File([new Uint8Array(100)], "x.pdf", { type: "application/pdf" });
      const res = await POST(makeUploadReq(file, "unknown_type"));
      expect(res.status).toBe(422);
    });
  });

  it("oversized file → 413", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      // One byte over the limit
      const bigBuffer = new Uint8Array(MAX_BYTES + 1);
      const file = new File([bigBuffer], "big.pdf", { type: "application/pdf" });
      const res = await POST(makeUploadReq(file, "passport"));
      expect(res.status).toBe(413);
    });
  });

  it("no prospect record → 400", async () => {
    await inRollbackTx(prisma, async (tx) => {
      // User without a prospect row
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const file = new File([new Uint8Array(100)], "x.pdf", { type: "application/pdf" });
      const res = await POST(makeUploadReq(file, "passport"));
      expect(res.status).toBe(400);
    });
  });

  it("valid PDF upload → 200, Document row created in DB", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      const prospect = await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const file = new File([new Uint8Array(100)], "passport.pdf", { type: "application/pdf" });
      const res = await POST(makeUploadReq(file, "passport"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.document.id).toBeTruthy();
      expect(json.document.type).toBe("passport");
      // Verify DB row
      const doc = await tx.document.findUnique({ where: { id: json.document.id } });
      expect(doc).not.toBeNull();
      expect(doc!.prospectId).toBe(prospect.id);
      expect(doc!.mime).toBe("application/pdf");
    });
  });

  it("valid JPG upload → 200", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const file = new File([new Uint8Array(200)], "address.jpg", { type: "image/jpeg" });
      const res = await POST(makeUploadReq(file, "proof_of_address"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.document.type).toBe("proof_of_address");
    });
  });
});
