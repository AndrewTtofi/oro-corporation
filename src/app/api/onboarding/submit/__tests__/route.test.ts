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
  return import("@/app/api/onboarding/submit/route");
}

afterEach(() => {
  sessionState.user = null;
  vi.resetModules();
});

/**
 * Minimal valid submitSchema body — uses "immigration" service so that
 * only permitType + familyCount are required as conditional fields.
 */
const validSubmitBody = {
  services: ["immigration"],
  fullLegalName: "Maria Testou",
  dateOfBirth: "1990-06-15",
  nationality: "GR",
  residenceCountry: "CY",
  address: "123 Test Street, Nicosia, Cyprus 1010",
  businessDescription: "A".repeat(100), // exactly the minimum 100 chars
  expectedTurnover: "<50K",
  timeline: "immediately",
  source: "google",
  // Immigration-specific required fields
  permitType: "work",
  familyCount: 0,
};

/** Seed a Document row directly. */
async function seedDocument(
  tx: PrismaClient,
  prospectId: string,
  type: "passport" | "proof_of_address",
) {
  return tx.document.create({
    data: {
      prospectId,
      type,
      storageKey: `test/${type}-${Date.now()}.pdf`,
      encMeta: { alg: "aes-256-gcm", ivB64: "AAAAAAAAAAAAAAAA", tagB64: "AAAAAAAAAAAAAAAAAAAAAA==", keyId: "test" } as never,
      originalName: `${type}.pdf`,
      mime: "application/pdf",
      sizeBytes: 512,
    },
  });
}

// ---------------------------------------------------------------------------
// POST — commitFormAnswers (Step 2)
// ---------------------------------------------------------------------------
describe("onboarding/submit POST route (commitFormAnswers)", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { POST } = await loadRoute(tx);
      await expect(POST(makeReq({ method: "POST", body: validSubmitBody }))).rejects.toThrow();
    });
  });

  it("empty body → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: {} }));
      expect(res.status).toBe(422);
    });
  });

  it("missing required personal fields → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      // services present but other required fields omitted
      const res = await POST(makeReq({ method: "POST", body: { services: ["accounting"] } }));
      expect(res.status).toBe(422);
    });
  });

  it("services with missing conditional fields → 422 (refineForSubmit)", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      // company_formation requires proposedCompanyName + shareholderCount
      const bodyMissingConditional = {
        ...validSubmitBody,
        services: ["company_formation"],
        // deliberately omit proposedCompanyName and shareholderCount
      };
      const res = await POST(makeReq({ method: "POST", body: bodyMissingConditional }));
      expect(res.status).toBe(422);
    });
  });

  it("valid body → 200, ProspectDetail rows created", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { POST } = await loadRoute(wrapTx(tx));
      const res = await POST(makeReq({ method: "POST", body: validSubmitBody }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.prospect.id).toBeTruthy();
      // Reference prefix is brand-derived (no firm configured in tests →
      // neutral default); assert the structural format, not a hard-coded brand.
      expect(json.prospect.reference).toMatch(/^[A-Z]+-\d{4}-\d{5}$/);
      // ProspectDetail rows must exist
      const details = await tx.prospectDetail.findMany({ where: { prospectId: json.prospect.id } });
      expect(details.length).toBeGreaterThan(0);
      const nameDetail = details.find((d) => d.fieldName === "fullLegalName");
      expect(nameDetail?.fieldValue).toBe("Maria Testou");
    });
  });
});

// ---------------------------------------------------------------------------
// PUT — submitProspect (Step 3 final submit)
// ---------------------------------------------------------------------------
describe("onboarding/submit PUT route (submitProspect)", () => {
  it("unauth → throws", async () => {
    await inRollbackTx(prisma, async (tx) => {
      sessionState.user = null;
      const { PUT } = await loadRoute(tx);
      await expect(PUT()).rejects.toThrow();
    });
  });

  it("no prospect record → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { PUT } = await loadRoute(wrapTx(tx));
      const res = await PUT();
      expect(res.status).toBe(422);
    });
  });

  it("prospect missing required docs → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      await createProspect(tx, { userId: user.id });
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { PUT } = await loadRoute(wrapTx(tx));
      // No documents seeded → missing passport + proof_of_address
      const res = await PUT();
      expect(res.status).toBe(422);
    });
  });

  it("missing proof_of_address only → 422", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      const prospect = await createProspect(tx, { userId: user.id });
      await seedDocument(tx, prospect.id, "passport");
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { PUT } = await loadRoute(wrapTx(tx));
      const res = await PUT();
      expect(res.status).toBe(422);
    });
  });

  it("all docs present → 200, ComplianceFile + Party + KycCase created", async () => {
    await inRollbackTx(prisma, async (tx) => {
      const user = await createUser(tx, { role: "prospect" });
      const prospect = await createProspect(tx, { userId: user.id });
      await seedDocument(tx, prospect.id, "passport");
      await seedDocument(tx, prospect.id, "proof_of_address");
      sessionState.user = { id: user.id, email: user.email, fullName: user.fullName, role: "prospect" };
      const { PUT } = await loadRoute(wrapTx(tx));
      const res = await PUT();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      // PUT preserves the prospect's existing reference (allocated at create
      // time); it does not re-derive a brand prefix here.
      expect(json.reference).toBe(prospect.referenceNumber);

      // Compliance infrastructure must be created
      const complianceFile = await tx.complianceFile.findUnique({ where: { prospectId: prospect.id } });
      expect(complianceFile).not.toBeNull();
      expect(complianceFile!.status).toBe("open");

      const parties = await tx.party.findMany({ where: { complianceFileId: complianceFile!.id } });
      expect(parties.length).toBeGreaterThan(0);
      const mainParty = parties.find((p) => p.role === "main_contact");
      expect(mainParty).not.toBeNull();

      const kycCase = await tx.kycCase.findUnique({ where: { partyId: mainParty!.id } });
      expect(kycCase).not.toBeNull();
    });
  });
});
