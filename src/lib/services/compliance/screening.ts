import { prisma } from "@/lib/db";
import { screening, type ScreeningQuery } from "@/lib/providers/screening";
import { logActivity } from "@/lib/services/activity";

export async function runScreening(kycCaseId: string, opts: { actorId: string | null }) {
  const kyc = await prisma.kycCase.findUnique({
    where: { id: kycCaseId },
    include: { party: true },
  });
  if (!kyc) throw new Error("KycCase not found");
  if (!kyc.party) throw new Error("KycCase missing party");

  const query: ScreeningQuery = kyc.party.type === "individual" ? {
    schema: "Person",
    name: kyc.party.fullName,
    birthDate: kyc.party.dateOfBirth ? toISODate(kyc.party.dateOfBirth) : undefined,
    nationality: kyc.party.nationality ?? undefined,
  } : {
    schema: "Organization",
    name: kyc.party.fullName,
    jurisdiction: kyc.party.jurisdiction ?? undefined,
    registrationNumber: kyc.party.registrationNumber ?? undefined,
  };

  const result = await screening().match(query);

  const run = await prisma.screeningRun.create({
    data: {
      kycCaseId,
      provider: screening().name,
      query: query as object,
      ranByActorId: opts.actorId,
      outcome: result.outcome,
      hitCount: result.hits.length,
      rawResponse: (result.raw ?? null) as object | null,
      errorMessage: result.errorMessage ?? null,
    },
  });

  if (result.hits.length > 0) {
    await prisma.screeningHit.createMany({
      data: result.hits.map((h) => ({
        screeningRunId: run.id,
        externalId: h.externalId,
        matchedName: h.matchedName,
        matchedSchema: h.matchedSchema,
        matchedTopics: h.matchedTopics,
        matchScore: h.matchScore,
        matchedListings: h.matchedListings as object,
        matchUrl: h.matchUrl ?? null,
      })),
    });
  }

  if (result.outcome !== "error") {
    await prisma.kycCase.update({
      where: { id: kycCaseId },
      data: { latestScreeningRunId: run.id },
    });
  }

  await logActivity({
    entityType: "screening_run", entityId: run.id,
    action: "compliance.screening_run",
    actorId: opts.actorId ?? undefined,
    meta: { kycCaseId, outcome: result.outcome, hitCount: result.hits.length },
  });

  return run;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
