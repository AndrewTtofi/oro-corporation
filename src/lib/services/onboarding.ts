import { prisma } from "@/lib/db";
import { allocateReferenceNumber } from "./reference";
import { logActivity } from "./activity";
import { createComplianceFileForProspect } from "@/lib/services/compliance/files";
import { ProspectStatus, type Prisma } from "@prisma/client";
import { submitSchema, type SubmitInput, type FullDraft, refineForSubmit, SERVICE_KEYS } from "@/lib/schema/onboarding";
import { computeCompleteness } from "@/lib/services/prospect-intel";

/** Returns the user's existing prospect or creates a new draft one. */
export async function ensureProspect(userId: string) {
  const existing = await prisma.prospect.findUnique({ where: { userId } });
  if (existing) return existing;
  const referenceNumber = await allocateReferenceNumber();
  const prospect = await prisma.prospect.create({
    data: {
      userId,
      referenceNumber,
      status: ProspectStatus.pending,
      servicesSelected: [],
    },
  });
  await logActivity({
    entityType: "prospect",
    entityId: prospect.id,
    action: "submission.created",
    actorId: userId,
    meta: { reference: referenceNumber },
  });
  return prospect;
}

export async function saveServicesSelection(userId: string, services: string[]) {
  const allowed = services.filter((s): s is (typeof SERVICE_KEYS)[number] =>
    (SERVICE_KEYS as readonly string[]).includes(s),
  );
  const prospect = await ensureProspect(userId);
  return prisma.prospect.update({
    where: { id: prospect.id },
    data: { servicesSelected: allowed },
  });
}

export async function saveDraft(userId: string, draft: FullDraft) {
  const prospect = await ensureProspect(userId);
  const merged: Record<string, unknown> = {
    ...((prospect.draft as Record<string, unknown> | null) ?? {}),
    ...(draft as Record<string, unknown>),
  };
  // Drop undefined keys so the JSON column doesn't accumulate cruft.
  for (const k of Object.keys(merged)) {
    if (merged[k] === undefined) delete merged[k];
  }
  const updated = await prisma.prospect.update({
    where: { id: prospect.id },
    data: { draft: merged as never },
  });
  await logActivity({
    entityType: "prospect",
    entityId: prospect.id,
    action: "submission.draft_saved",
    actorId: userId,
  });
  return updated;
}

/** Finalize Step-2 — promotes draft to ProspectDetail rows + advances to documents. */
export async function commitFormAnswers(userId: string, input: SubmitInput) {
  const parsed = submitSchema.parse(input);
  const conditionalErrors = refineForSubmit(parsed);
  if (conditionalErrors.length) {
    return { ok: false as const, errors: conditionalErrors };
  }
  const prospect = await ensureProspect(userId);

  // Write canonical key/value rows (replace any prior values for the same keys)
  const flat = Object.entries(parsed).filter(([k]) => k !== "services") as [string, unknown][];
  await prisma.$transaction([
    prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        servicesSelected: parsed.services,
        draft: parsed as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.prospectDetail.deleteMany({ where: { prospectId: prospect.id } }),
    prisma.prospectDetail.createMany({
      data: flat
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([fieldName, v]) => ({
          prospectId: prospect.id,
          fieldName,
          fieldValue: typeof v === "string" ? v : JSON.stringify(v),
        })),
    }),
  ]);

  return { ok: true as const, prospect };
}

/** Final submit at end of Step-3 — locks state to pending review. */
export async function submitProspect(userId: string) {
  const prospect = await prisma.prospect.findUnique({ where: { userId } });
  if (!prospect) return { ok: false as const, reason: "NO_PROSPECT" as const };
  const docs = await prisma.document.findMany({ where: { prospectId: prospect.id } });
  const hasPassport = docs.some((d) => d.type === "passport");
  const hasAddress = docs.some((d) => d.type === "proof_of_address");
  if (!hasPassport || !hasAddress) {
    return { ok: false as const, reason: "MISSING_DOCS" as const };
  }

  // Compute the brief-completeness score from the draft before it is cleared.
  const answers = (prospect.draft as Record<string, unknown> | null) ?? {};
  const services = Array.isArray(prospect.servicesSelected) ? (prospect.servicesSelected as string[]) : [];
  const completeness = computeCompleteness({ services, answers, docCount: docs.length });

  const updated = await prisma.prospect.update({
    where: { id: prospect.id },
    data: { status: ProspectStatus.pending, draft: undefined, completeness },
  });
  await logActivity({
    entityType: "prospect",
    entityId: prospect.id,
    action: "submission.submitted",
    actorId: userId,
    meta: { reference: updated.referenceNumber },
  });
  await createComplianceFileForProspect(updated.id, userId);
  return { ok: true as const, prospect: updated };
}
