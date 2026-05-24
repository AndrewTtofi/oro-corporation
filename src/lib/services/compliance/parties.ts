import { prisma } from "@/lib/db";
import type { PartyRole, PartyType } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface NewPartyInput {
  type: PartyType;
  role: PartyRole;
  fullName: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  countryOfResidence?: string | null;
  passportNumber?: string | null;
  registrationNumber?: string | null;
  jurisdiction?: string | null;
  ownershipPct?: number | null;
  isPep?: boolean;
}

export async function addParty(complianceFileId: string, input: NewPartyInput, actorId: string) {
  const party = await prisma.$transaction(async (tx) => {
    const created = await tx.party.create({
      data: {
        complianceFileId,
        type: input.type,
        role: input.role,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        nationality: input.nationality ?? null,
        countryOfResidence: input.countryOfResidence ?? null,
        passportNumber: input.passportNumber ?? null,
        registrationNumber: input.registrationNumber ?? null,
        jurisdiction: input.jurisdiction ?? null,
        ownershipPct: input.ownershipPct ?? null,
        isPep: input.isPep ?? false,
      },
    });
    await tx.kycCase.create({ data: { partyId: created.id } });
    return created;
  });
  await logActivity({
    entityType: "party",
    entityId: party.id,
    action: "compliance.party_added",
    actorId,
    meta: { complianceFileId, role: input.role, fullName: input.fullName },
  });
  return party;
}

export async function updateParty(partyId: string, patch: Partial<NewPartyInput>, actorId: string) {
  await prisma.party.update({
    where: { id: partyId },
    data: {
      ...(patch.fullName !== undefined && { fullName: patch.fullName }),
      ...(patch.dateOfBirth !== undefined && { dateOfBirth: patch.dateOfBirth ? new Date(patch.dateOfBirth) : null }),
      ...(patch.nationality !== undefined && { nationality: patch.nationality }),
      ...(patch.countryOfResidence !== undefined && { countryOfResidence: patch.countryOfResidence }),
      ...(patch.passportNumber !== undefined && { passportNumber: patch.passportNumber }),
      ...(patch.registrationNumber !== undefined && { registrationNumber: patch.registrationNumber }),
      ...(patch.jurisdiction !== undefined && { jurisdiction: patch.jurisdiction }),
      ...(patch.ownershipPct !== undefined && { ownershipPct: patch.ownershipPct }),
      ...(patch.isPep !== undefined && { isPep: patch.isPep }),
      ...(patch.role !== undefined && { role: patch.role }),
    },
  });
}

export async function removeParty(partyId: string, actorId: string) {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { kycCase: { include: { screeningRuns: { take: 1 } } } },
  });
  if (!party) throw new Error("Party not found");
  if (party.role === "main_contact") throw new Error("Cannot remove main_contact party");
  if ((party.kycCase?.screeningRuns?.length ?? 0) > 0) {
    throw new Error("Party has screening history; cannot remove (audit). Consider editing instead.");
  }
  await prisma.party.delete({ where: { id: partyId } });
  await logActivity({
    entityType: "party",
    entityId: partyId,
    action: "compliance.party_removed",
    actorId,
    meta: { complianceFileId: party.complianceFileId },
  });
}

export interface IdvUpdate {
  idvStatus?: "pending" | "verified" | "failed";
  idvNote?: string | null;
  passportDocId?: string | null;
  proofOfAddressDocId?: string | null;
  sofDocId?: string | null;
  sofNote?: string | null;
}

export async function updateKycCase(partyId: string, patch: IdvUpdate, actorId: string) {
  const kyc = await prisma.kycCase.findUnique({ where: { partyId } });
  if (!kyc) throw new Error("KycCase not found");

  const stateNext = patch.idvStatus === "verified"
    ? "passed" : patch.idvStatus === "failed" ? "blocked" : kyc.state;

  const updated = await prisma.kycCase.update({
    where: { partyId },
    data: {
      ...(patch.idvStatus !== undefined && {
        idvStatus: patch.idvStatus,
        idvReviewedById: actorId,
        idvReviewedAt: new Date(),
      }),
      ...(patch.idvNote !== undefined && { idvNote: patch.idvNote }),
      ...(patch.passportDocId !== undefined && { passportDocId: patch.passportDocId }),
      ...(patch.proofOfAddressDocId !== undefined && { proofOfAddressDocId: patch.proofOfAddressDocId }),
      ...(patch.sofDocId !== undefined && { sofDocId: patch.sofDocId }),
      ...(patch.sofNote !== undefined && { sofNote: patch.sofNote }),
      state: stateNext,
    },
  });

  if (patch.idvStatus === "verified") {
    await logActivity({
      entityType: "kyc_case", entityId: updated.id,
      action: "compliance.idv_verified", actorId,
    });
  } else if (patch.idvStatus === "failed") {
    await logActivity({
      entityType: "kyc_case", entityId: updated.id,
      action: "compliance.idv_failed", actorId,
      meta: { note: patch.idvNote },
    });
  }
  return updated;
}
