import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { computeRisk, type PartyInput, type RiskRatingLabel } from "./risk";

export async function recomputeAndStoreRisk(complianceFileId: string, actorId: string | null) {
  const file = await prisma.complianceFile.findUnique({
    where: { id: complianceFileId },
    include: {
      parties: true,
      prospect: true,
    },
  });
  if (!file) throw new Error("File not found");

  const parties: PartyInput[] = file.parties.map((p) => ({
    role: p.role,
    isPep: p.isPep,
    nationality: p.nationality,
    countryOfResidence: p.countryOfResidence,
    jurisdiction: p.jurisdiction,
  }));

  const draft = (file.prospect?.draft as Record<string, unknown> | null) ?? {};
  const result = computeRisk({
    parties,
    expectedTurnover: ((draft.expectedTurnover as string) ?? "<50K") as never,
    businessActivity: (draft.businessActivity as string) ?? null,
    hasNominees: Boolean(draft.nomineeServices),
    entityLayers: 1,
  });

  await prisma.complianceFile.update({
    where: { id: complianceFileId },
    data: {
      riskComputed: result.rating,
      riskComputedScore: result.score,
      riskAssessedAt: new Date(),
      riskAssessedById: actorId,
    },
  });

  await logActivity({
    entityType: "compliance_file", entityId: complianceFileId,
    action: "compliance.risk_assessed", actorId: actorId ?? undefined,
    meta: { rating: result.rating, score: result.score, factors: result.factors },
  });

  return result;
}

export async function overrideRiskRating(
  complianceFileId: string, rating: RiskRatingLabel, reason: string, actorId: string,
) {
  if (!reason || reason.trim().length < 5) throw new Error("Override reason required");
  const file = await prisma.complianceFile.findUnique({ where: { id: complianceFileId } });
  if (!file) throw new Error("File not found");

  const escalated = file.riskComputed && rank(rating) < rank(file.riskComputed);
  await prisma.complianceFile.update({
    where: { id: complianceFileId },
    data: {
      riskRating: rating,
      riskOverrideReason: reason,
      riskAssessedAt: new Date(),
      riskAssessedById: actorId,
    },
  });

  await logActivity({
    entityType: "compliance_file", entityId: complianceFileId,
    action: "compliance.risk_overridden", actorId,
    meta: { before: file.riskComputed, after: rating, reason, escalated: !!escalated },
  });
}

function rank(r: string) { return r === "low" ? 0 : r === "standard" ? 1 : 2; }
