import { prisma } from "@/lib/db";

export type LeadSource = "calculator" | "intake" | "manual";

/** Create a lead, or refresh an existing one with the same email + source so we
 *  don't pile up duplicates from repeated calculator reveals / save-and-exits. */
export async function upsertLead(input: {
  email: string;
  name?: string | null;
  serviceKey?: string | null;
  source: LeadSource;
  note?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.lead.findFirst({
    where: { email, source: input.source },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return prisma.lead.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        name: input.name ?? existing.name,
        serviceKey: input.serviceKey ?? existing.serviceKey,
        note: input.note ?? existing.note,
      },
    });
  }
  return prisma.lead.create({
    data: {
      email,
      name: input.name ?? null,
      serviceKey: input.serviceKey ?? null,
      source: input.source,
      note: input.note ?? null,
    },
  });
}

export async function listLeads() {
  return prisma.lead.findMany({ orderBy: { lastActivityAt: "desc" } });
}
