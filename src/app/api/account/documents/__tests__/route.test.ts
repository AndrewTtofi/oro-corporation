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
vi.mock("@/lib/providers/storage", () => ({
  storage: () => ({
    put: async (key: string, _buf: Buffer, _mime: string) => ({
      key, encMeta: {}, sizeBytes: 4,
    }),
  }),
}));

// Inject `db` (tx or top-level prisma) as the module prisma so service code sees seeded data.
async function loadRoute(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/app/api/account/documents/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

describe("account/documents route", () => {
  it("unauth: throws (assertRole behavior)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      const form = new FormData();
      await expect(POST(makeReq({ method: "POST", form }))).rejects.toThrow();
    });
  });

  it("missing file field → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(tx);
      const form = new FormData();
      // no file appended
      const res = await POST(makeReq({ method: "POST", form }));
      expect(res.status).toBe(422);
    });
  });

  it("client uploads (multipart) → 200, Document row created with purpose=other", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const user = await tx.user.findUnique({ where: { id: client.userId } });
      sessionState.user = { id: user!.id, email: user!.email, fullName: user!.fullName, role: "client" };
      const { POST } = await loadRoute(tx);
      const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "x.pdf", { type: "application/pdf" });
      const form = new FormData();
      form.append("file", file);
      const res = await POST(makeReq({ method: "POST", form }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.documentId).toBeTruthy();
      const doc = await tx.document.findUnique({ where: { id: json.documentId } });
      expect(doc).not.toBeNull();
      expect(doc?.purpose).toBe("other");
      expect(doc?.prospectId).toBe(client.prospectId);
    });
  });

  it("client tries to fulfill a DocumentRequest belonging to another client → 400", async () => {
    await inRollbackTx(prisma, async (tx) => {
      // Create two separate clients
      const clientA = await createClient(tx);
      const clientB = await createClient(tx);

      // Create a staff user to attach the request to clientA
      const staffUser = await tx.user.findUnique({ where: { id: clientA.primaryStaffId } });

      // Create a DocumentRequest belonging to clientA
      const docRequest = await tx.documentRequest.create({
        data: {
          clientId: clientA.id,
          description: "ID Proof",
          serviceTypeKey: null,
          state: "open",
          requestedById: staffUser!.id,
        },
      });

      // ClientB tries to fulfill clientA's request
      const userB = await tx.user.findUnique({ where: { id: clientB.userId } });
      sessionState.user = { id: userB!.id, email: userB!.email, fullName: userB!.fullName, role: "client" };
      const { POST } = await loadRoute(tx);
      const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "x.pdf", { type: "application/pdf" });
      const form = new FormData();
      form.append("file", file);
      form.append("fulfillsRequestId", docRequest.id);
      const res = await POST(makeReq({ method: "POST", form }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/not yours/i);
    });
  });
});
