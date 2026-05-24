import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export async function createComplianceFileForProspect(prospectId: string, actorId: string | null) {
  const existing = await prisma.complianceFile.findUnique({ where: { prospectId } });
  if (existing) return existing;

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: { user: true, documents: true },
  });
  if (!prospect) throw new Error("Prospect not found");

  const file = await prisma.$transaction(async (tx) => {
    const cf = await tx.complianceFile.create({
      data: { prospectId, status: "open" },
    });

    const mainParty = await tx.party.create({
      data: {
        complianceFileId: cf.id,
        type: "individual",
        role: "main_contact",
        fullName: prospect.user.fullName,
        nationality: null,
      },
    });
    const kyc = await tx.kycCase.create({
      data: { partyId: mainParty.id },
    });

    for (const doc of prospect.documents) {
      const purpose =
        doc.type === "passport"
          ? "passport"
          : doc.type === "proof_of_address"
            ? "proof_of_address"
            : "other";
      await tx.document.update({
        where: { id: doc.id },
        data: { partyId: mainParty.id, purpose },
      });
      if (purpose === "passport") {
        await tx.kycCase.update({ where: { id: kyc.id }, data: { passportDocId: doc.id } });
      } else if (purpose === "proof_of_address") {
        await tx.kycCase.update({ where: { id: kyc.id }, data: { proofOfAddressDocId: doc.id } });
      }
    }
    return cf;
  });

  await logActivity({
    // TODO Task 11 widens these unions; the cast is removed there.
    entityType: "compliance_file" as never,
    entityId: file.id,
    action: "compliance.file_created" as never,
    actorId: actorId ?? undefined,
    meta: { prospectId },
  });
  return file;
}
