import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { PartyWorkspace } from "@/components/compliance/PartyWorkspace";

export const dynamic = "force-dynamic";

export default async function PartyPage({ params }: { params: Promise<{ id: string; partyId: string }> }) {
  await requireRole("staff");
  const { partyId } = await params;
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      kycCase: { include: { latestScreeningRun: { include: { hits: true } } } },
    },
  });
  if (!party) notFound();
  return (
    <AdminShell active="clients">
      <div className="mb-6">
        <h1 className="font-display text-2xl">{party.fullName}</h1>
        <p className="text-meta text-admin-muted capitalize">{party.role.replace("_", " ")} · {party.type}</p>
      </div>
      <PartyWorkspace party={{
        id: party.id, fullName: party.fullName, role: party.role, type: party.type,
        kycCase: party.kycCase ? {
          id: party.kycCase.id,
          idvStatus: party.kycCase.idvStatus,
          passportDocId: party.kycCase.passportDocId,
          proofOfAddressDocId: party.kycCase.proofOfAddressDocId,
          sofDocId: party.kycCase.sofDocId,
          latestScreeningRun: party.kycCase.latestScreeningRun ? {
            id: party.kycCase.latestScreeningRun.id,
            outcome: party.kycCase.latestScreeningRun.outcome,
            ranAt: party.kycCase.latestScreeningRun.ranAt.toISOString(),
            hits: party.kycCase.latestScreeningRun.hits.map((h) => ({
              id: h.id, matchedName: h.matchedName, matchedTopics: h.matchedTopics,
              matchScore: h.matchScore, reviewStatus: h.reviewStatus, matchUrl: h.matchUrl,
            })),
          } : null,
        } : null,
      }} />
    </AdminShell>
  );
}
