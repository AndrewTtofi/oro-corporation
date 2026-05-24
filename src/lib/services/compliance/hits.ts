import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export async function reviewHit(
  hitId: string,
  next: "false_positive" | "confirmed_match" | "escalated",
  note: string | null,
  actorId: string,
) {
  if ((next === "confirmed_match" || next === "escalated") && !note) {
    throw new Error("A note is required for confirmed_match or escalated");
  }
  const hit = await prisma.screeningHit.findUnique({
    where: { id: hitId },
    include: { screeningRun: { include: { kycCase: { include: { party: true } } } } },
  });
  if (!hit) throw new Error("Hit not found");

  await prisma.screeningHit.update({
    where: { id: hitId },
    data: {
      reviewStatus: next,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });

  // Auto-flip isPep when confirming a PEP match
  if (next === "confirmed_match" && hit.matchedTopics.includes("role.pep")) {
    await prisma.party.update({ where: { id: hit.screeningRun.kycCase.party.id }, data: { isPep: true } });
  }

  // Auto-block ComplianceFile when confirming a sanctions match
  if (next === "confirmed_match" && hit.matchedTopics.includes("sanction")) {
    const partyId = hit.screeningRun.kycCase.party.id;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (party) {
      await prisma.complianceFile.update({
        where: { id: party.complianceFileId },
        data: { status: "blocked" },
      });
      await logActivity({
        entityType: "compliance_file", entityId: party.complianceFileId,
        action: "compliance.blocked", actorId,
        meta: { reason: "confirmed_sanctions_match", hitId },
      });
    }
  }

  await logActivity({
    entityType: "screening_run", entityId: hit.screeningRunId,
    action: "compliance.hit_reviewed", actorId,
    meta: { hitId, next, topics: hit.matchedTopics },
  });
}
