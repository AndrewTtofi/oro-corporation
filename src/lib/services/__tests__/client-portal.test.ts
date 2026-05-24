import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, stopTestPrisma } from "@/test/db";
import { inRollbackTx, wrapTx } from "@/test/tx";
import { createUser, createProspect, createClient, createDocumentRequest } from "@/test/seed";

let prisma: PrismaClient;
beforeAll(async () => { prisma = await getTestPrisma(); });
afterAll(async () => { await stopTestPrisma(); });

vi.mock("@/lib/db", () => ({ prisma: undefined as unknown as PrismaClient }));

vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async () => ({ ok: true }) }),
}));

vi.mock("@/lib/providers/storage", () => ({
  storage: () => ({
    put: async (key: string, buf: Buffer, _mime: string) => ({
      key,
      encMeta: { alg: "aes-256-gcm", ivB64: "AAAAAAAAAAAAAAAA", tagB64: "AAAAAAAAAAAAAAAAAAAAAA==", keyId: "test" },
      sizeBytes: buf.byteLength,
    }),
    getStream: async () => { throw new Error("not implemented in tests"); },
    delete: async () => { /* no-op */ },
  }),
}));

async function loadService(db: PrismaClient) {
  const dbMod = await import("@/lib/db");
  (dbMod as { prisma: PrismaClient }).prisma = db;
  return import("@/lib/services/client-portal");
}

afterEach(() => {
  vi.resetModules();
});

describe("sendClientMessage", () => {
  it("writes Message.clientId when user is a Client", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const { sendClientMessage } = await loadService(tx);

      await sendClientMessage(client.userId, "Hello from client");

      const messages = await tx.message.findMany({ where: { clientId: client.id } });
      expect(messages).toHaveLength(1);
      expect(messages[0].clientId).toBe(client.id);
      expect(messages[0].prospectId).toBeNull();
    });
  });

  it("writes Message.prospectId when user is still a Prospect", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const prospect = await createProspect(tx);
      const { sendClientMessage } = await loadService(tx);

      await sendClientMessage(prospect.userId, "Hello from prospect");

      const messages = await tx.message.findMany({ where: { prospectId: prospect.id } });
      expect(messages).toHaveLength(1);
      expect(messages[0].prospectId).toBe(prospect.id);
      expect(messages[0].clientId).toBeNull();
    });
  });

  it("throws on empty body", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const prospect = await createProspect(tx);
      const { sendClientMessage } = await loadService(tx);

      await expect(sendClientMessage(prospect.userId, "  ")).rejects.toThrow(/body/i);
    });
  });
});

describe("getMessagesForUser", () => {
  it("returns messages tied to either prospect or client", async () => {
    await inRollbackTx(prisma, async (tx) => {
      // Create a client (which has an underlying prospect + user)
      const client = await createClient(tx);
      const prospect = await tx.prospect.findUnique({ where: { id: client.prospectId } });

      // Seed one message via prospectId (pre-conversion) and one via clientId
      const staffUser = await createUser(tx, { role: "staff" });
      await tx.message.create({ data: { senderId: staffUser.id, body: "old prospect msg", prospectId: prospect!.id } });
      await tx.message.create({ data: { senderId: staffUser.id, body: "new client msg", clientId: client.id } });

      // Seed a message for a different client to confirm it's excluded
      const otherClient = await createClient(tx);
      await tx.message.create({ data: { senderId: staffUser.id, body: "other", clientId: otherClient.id } });

      const { getMessagesForUser } = await loadService(tx);
      const out = await getMessagesForUser(client.userId);

      expect(out).toHaveLength(2);
      const bodies = out.map((m: { body: string }) => m.body).sort();
      expect(bodies).toEqual(["new client msg", "old prospect msg"]);
    });
  });
});

describe("updateClientSelfProfile", () => {
  it("rejects fields not in whitelist", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const { updateClientSelfProfile } = await loadService(wrapTx(tx));

      await expect(
        updateClientSelfProfile(client.userId, { companyName: "x" } as never),
      ).rejects.toThrow(/unknown/i);
    });
  });

  it("updates allowed user + client fields in the real DB", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const { updateClientSelfProfile } = await loadService(wrapTx(tx));

      await updateClientSelfProfile(client.userId, {
        fullName: "Updated Name",
        taxResidency: "CY",
      });

      const updatedUser = await tx.user.findUnique({ where: { id: client.userId } });
      expect(updatedUser?.fullName).toBe("Updated Name");

      const updatedClient = await tx.client.findUnique({ where: { id: client.id } });
      expect(updatedClient?.taxResidency).toBe("CY");
    });
  });
});

describe("uploadClientDocument", () => {
  it("rejects fulfillment of a DocumentRequest not owned by the user's client", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const otherClient = await createClient(tx);
      const docRequest = await createDocumentRequest(tx, {
        clientId: otherClient.id,
        serviceTypeKey: "company_formation",
      });

      const { uploadClientDocument } = await loadService(tx);

      await expect(
        uploadClientDocument(client.userId, {
          file: Buffer.from("x"),
          originalName: "x.pdf",
          mime: "application/pdf",
          fulfillsRequestId: docRequest.id,
        }),
      ).rejects.toThrow(/not yours/i);
    });
  });

  it("forwards purpose=other + the request's serviceTypeKey on fulfillment", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const docRequest = await createDocumentRequest(tx, {
        clientId: client.id,
        serviceTypeKey: "tax_residency",
      });

      const { uploadClientDocument } = await loadService(tx);

      const result = await uploadClientDocument(client.userId, {
        file: Buffer.from("x"),
        originalName: "x.pdf",
        mime: "application/pdf",
        fulfillsRequestId: docRequest.id,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = await tx.document.findUnique({ where: { id: result.doc.id } });
      expect(doc).not.toBeNull();
      expect(doc!.serviceTypeKey).toBe("tax_residency");
      expect(doc!.purpose).toBe("other");
      expect(doc!.type).toBe("other");

      // The request should be marked fulfilled
      const req = await tx.documentRequest.findUnique({ where: { id: docRequest.id } });
      expect(req?.state).toBe("fulfilled");
    });
  });

  it("uploads as Correspondence (purpose=other, no serviceTypeKey) when no folder and no request", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const client = await createClient(tx);
      const { uploadClientDocument } = await loadService(tx);

      const result = await uploadClientDocument(client.userId, {
        file: Buffer.from("y"),
        originalName: "y.pdf",
        mime: "application/pdf",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = await tx.document.findUnique({ where: { id: result.doc.id } });
      expect(doc).not.toBeNull();
      expect(doc!.serviceTypeKey).toBeNull();
      expect(doc!.purpose).toBe("other");
    });
  });
});
