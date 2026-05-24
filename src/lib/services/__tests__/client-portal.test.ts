import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => {
  const messages: any[] = [];
  const userById = new Map<string, any>();
  const prospectByUserId = new Map<string, any>();
  const clientByUserId = new Map<string, any>();
  const docRequestById = new Map<string, any>();
  return {
    messages, userById, prospectByUserId, clientByUserId, docRequestById,
    reset() {
      messages.length = 0;
      userById.clear(); prospectByUserId.clear(); clientByUserId.clear(); docRequestById.clear();
    },
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: async ({ where: { id } }: any) => db.userById.get(id) ?? null },
    prospect: {
      findUnique: async ({ where: { userId } }: any) => db.prospectByUserId.get(userId) ?? null,
    },
    client: {
      findUnique: async ({ where }: any) => {
        if (where.userId) return db.clientByUserId.get(where.userId) ?? null;
        return null;
      },
      update: async ({ where, data }: any) => {
        for (const [, c] of db.clientByUserId.entries()) {
          if (c.id === where.id) { Object.assign(c, data); return c; }
        }
        return null;
      },
    },
    message: {
      create: async ({ data }: any) => {
        const m = { id: `m${db.messages.length + 1}`, ...data, createdAt: new Date() };
        db.messages.push(m);
        return m;
      },
      findMany: async ({ where }: any) => {
        return db.messages.filter((m) =>
          (where.OR ?? []).some((c: any) =>
            (c.prospectId !== undefined && c.prospectId === m.prospectId) ||
            (c.clientId   !== undefined && c.clientId   === m.clientId),
          ),
        );
      },
    },
    documentRequest: { findUnique: async ({ where: { id } }: any) => db.docRequestById.get(id) ?? null },
    activityLog: { create: async () => null },
    $transaction: async (fn: any) => fn({
      user:   { update: async ({ where: { id }, data }: any) => { const u = db.userById.get(id); Object.assign(u, data); return u; } },
      client: {
        findUnique: async ({ where: { userId } }: any) => db.clientByUserId.get(userId) ?? null,
        update: async ({ where: { id }, data }: any) => {
          for (const [, c] of db.clientByUserId.entries()) {
            if (c.id === id) { Object.assign(c, data); return c; }
          }
          return null;
        },
      },
    }),
  },
}));

const emailMock = vi.hoisted(() => ({ sent: [] as any[] }));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({ send: async (args: any) => { emailMock.sent.push(args); return { ok: true }; } }),
}));

import { sendClientMessage, getMessagesForUser, updateClientSelfProfile } from "../client-portal";

beforeEach(() => { db.reset(); emailMock.sent.length = 0; });

describe("sendClientMessage", () => {
  it("writes Message.clientId when user is a Client; emails primaryStaff", async () => {
    db.userById.set("u1", { id: "u1", fullName: "Client User" });
    db.prospectByUserId.set("u1", { id: "p1", userId: "u1", reviewedById: null });
    db.clientByUserId.set("u1", { id: "c1", userId: "u1", primaryStaff: { email: "staff@x.com" } });
    await sendClientMessage("u1", "Hello");
    expect(db.messages[0].clientId).toBe("c1");
    expect(db.messages[0].prospectId).toBeUndefined();
    expect(emailMock.sent[0].to).toBe("staff@x.com");
  });
  it("writes Message.prospectId when user is still a Prospect; emails reviewer if any", async () => {
    db.userById.set("u2", { id: "u2", fullName: "Pending" });
    db.prospectByUserId.set("u2", { id: "p2", userId: "u2", reviewedBy: { email: "rev@x.com" } });
    await sendClientMessage("u2", "Hi");
    expect(db.messages[0].prospectId).toBe("p2");
    expect(db.messages[0].clientId).toBeUndefined();
    expect(emailMock.sent[0].to).toBe("rev@x.com");
  });
  it("throws on empty body", async () => {
    db.userById.set("u3", { id: "u3" });
    db.prospectByUserId.set("u3", { id: "p3", userId: "u3" });
    await expect(sendClientMessage("u3", "  ")).rejects.toThrow(/body/i);
  });
});

describe("getMessagesForUser", () => {
  it("returns messages tied to either prospect or client", async () => {
    db.userById.set("u4", { id: "u4" });
    db.prospectByUserId.set("u4", { id: "p4", userId: "u4" });
    db.clientByUserId.set("u4", { id: "c4", userId: "u4" });
    db.messages.push(
      { id: "m1", prospectId: "p4", body: "old prospect msg",  createdAt: new Date(1) },
      { id: "m2", clientId:   "c4", body: "new client msg",    createdAt: new Date(2) },
      { id: "m3", clientId:   "other", body: "other client",   createdAt: new Date(3) },
    );
    const out = await getMessagesForUser("u4");
    expect(out.map((m: any) => m.id).sort()).toEqual(["m1", "m2"]);
  });
});

describe("updateClientSelfProfile", () => {
  it("rejects fields not in whitelist", async () => {
    db.userById.set("u5", { id: "u5" });
    db.clientByUserId.set("u5", { id: "c5", userId: "u5" });
    await expect(
      updateClientSelfProfile("u5", { companyName: "x" } as any),
    ).rejects.toThrow(/unknown/i);
  });
});
