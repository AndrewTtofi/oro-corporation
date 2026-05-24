import type { PrismaClient, Role } from "@prisma/client";

let counter = 0;
const uniq = () => `${Date.now()}-${++counter}`;

export async function createUser(tx: PrismaClient, opts: { role?: Role; fullName?: string; email?: string } = {}) {
  return tx.user.create({
    data: {
      email: opts.email ?? `u-${uniq()}@test.local`,
      fullName: opts.fullName ?? "Test User",
      role: opts.role ?? "prospect",
      emailVerified: new Date(),
      passwordHash: "x",
    },
  });
}

export async function createProspect(tx: PrismaClient, opts: { userId?: string; status?: "pending" | "approved" | "needs_info" | "rejected" } = {}) {
  const userId = opts.userId ?? (await createUser(tx, { role: "prospect" })).id;
  return tx.prospect.create({
    data: {
      userId,
      referenceNumber: `ORO-TEST-${uniq()}`,
      status: opts.status ?? "approved",
      servicesSelected: [],
    },
  });
}

export async function createClient(tx: PrismaClient, opts: { userId?: string; prospectId?: string; primaryStaffId?: string } = {}) {
  const userId = opts.userId ?? (await createUser(tx, { role: "client" })).id;
  const prospectId = opts.prospectId ?? (await createProspect(tx, { userId })).id;
  const primaryStaffId = opts.primaryStaffId ?? (await createUser(tx, { role: "staff" })).id;
  return tx.client.create({
    data: { userId, prospectId, primaryStaffId },
  });
}

export async function createStaff(tx: PrismaClient) {
  return createUser(tx, { role: "staff" });
}

export async function createComplianceFile(
  tx: PrismaClient,
  opts: { prospectId?: string; status?: "open" | "in_review" | "cleared" | "blocked"; riskRating?: "low" | "standard" | "high" } = {},
) {
  const prospectId = opts.prospectId ?? (await createProspect(tx)).id;
  return tx.complianceFile.create({
    data: {
      prospectId,
      status: opts.status ?? "open",
      ...(opts.riskRating !== undefined && { riskRating: opts.riskRating }),
    },
  });
}

export async function createParty(
  tx: PrismaClient,
  opts: {
    complianceFileId: string;
    role?: "main_contact" | "ubo" | "director" | "shareholder" | "signatory" | "intermediary";
    type?: "individual" | "entity";
    fullName?: string;
    isPep?: boolean;
  },
) {
  let counter2 = 0;
  const uniq2 = () => `${Date.now()}-${++counter2}`;
  return tx.party.create({
    data: {
      complianceFileId: opts.complianceFileId,
      type: opts.type ?? "individual",
      role: opts.role ?? "ubo",
      fullName: opts.fullName ?? `Party-${uniq2()}`,
      isPep: opts.isPep ?? false,
    },
  });
}

export async function createKycCase(
  tx: PrismaClient,
  opts: { partyId: string; state?: "pending" | "in_progress" | "passed" | "blocked" },
) {
  return tx.kycCase.create({
    data: {
      partyId: opts.partyId,
      state: opts.state ?? "pending",
    },
  });
}

export async function createPartner(tx: PrismaClient) {
  return createUser(tx, { role: "partner" });
}

export async function createService(
  tx: PrismaClient,
  opts: { key?: string; label?: string; active?: boolean } = {},
) {
  const key = opts.key ?? `svc_${uniq().replace(/-/g, "_")}`;
  return tx.service.create({
    data: {
      key,
      label: opts.label ?? `Service ${key}`,
      active: opts.active ?? true,
    },
  });
}

export async function createClientService(
  tx: PrismaClient,
  opts: { clientId: string; serviceType?: string },
) {
  return tx.clientService.create({
    data: {
      clientId: opts.clientId,
      serviceType: opts.serviceType ?? "accounting",
      status: "pending",
    },
  });
}

export async function createDocumentRequest(
  tx: PrismaClient,
  opts: {
    clientId: string;
    requestedById?: string;
    description?: string;
    serviceTypeKey?: string | null;
    state?: "open" | "fulfilled" | "cancelled";
  },
) {
  const requestedById = opts.requestedById ?? (await createUser(tx, { role: "staff" })).id;
  return tx.documentRequest.create({
    data: {
      clientId: opts.clientId,
      requestedById,
      description: opts.description ?? "Please upload the requested document",
      serviceTypeKey: opts.serviceTypeKey ?? null,
      state: opts.state ?? "open",
    },
  });
}
