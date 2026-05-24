import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export async function signOffComplianceFile(complianceFileId: string, note: string, actorId: string) {
  if (!note || note.trim().length < 5) throw new Error("Sign-off note required");
  const file = await prisma.complianceFile.findUnique({
    where: { id: complianceFileId },
    include: { parties: { include: { kycCase: { include: { screeningRuns: { include: { hits: true }, orderBy: { ranAt: "desc" }, take: 1 } } } } } },
  });
  if (!file) throw new Error("File not found");
  if (file.status === "blocked") throw new Error("Cannot sign off a blocked file");
  if (!file.riskRating) throw new Error("Risk rating must be set before sign-off");

  for (const party of file.parties) {
    if (!party.kycCase || party.kycCase.state !== "passed") {
      throw new Error(`Party ${party.fullName} not yet passed`);
    }
    const latest = party.kycCase.screeningRuns[0];
    if (latest?.hits.some((h) => h.reviewStatus === "unreviewed")) {
      throw new Error(`Party ${party.fullName} has unreviewed hits`);
    }
  }

  await prisma.complianceFile.update({
    where: { id: complianceFileId },
    data: {
      status: "cleared",
      signedOffById: actorId,
      signedOffAt: new Date(),
      signedOffNote: note,
    },
  });
  await logActivity({
    entityType: "compliance_file", entityId: complianceFileId,
    action: "compliance.signed_off", actorId,
    meta: { note },
  });
}
