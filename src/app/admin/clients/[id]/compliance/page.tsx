import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { recomputeAndStoreRisk } from "@/lib/services/compliance/risk-persist";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance" };

export default async function ClientCompliancePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const file = await prisma.complianceFile.findFirst({
    where: { clientId: id },
    include: {
      parties: {
        include: {
          kycCase: { include: { latestScreeningRun: { include: { hits: true } } } },
        },
      },
      reviewTasks: { where: { state: "open" }, include: { assignedTo: true } },
    },
  });
  if (!file) notFound();
  if (!file.riskComputed) await recomputeAndStoreRisk(file.id, null);
  return (
    <AdminShell active="clients">
      <ComplianceDashboard file={serialize(file)} parentLink={`/admin/clients/${id}/compliance`} />
    </AdminShell>
  );
}

function serialize(f: any) {
  return {
    ...f,
    signedOffAt: f.signedOffAt?.toISOString() ?? null,
    parties: f.parties.map((p: any) => ({
      ...p,
      kycCase: p.kycCase ? {
        ...p.kycCase,
        latestScreeningRun: p.kycCase.latestScreeningRun ? {
          ...p.kycCase.latestScreeningRun,
          hits: p.kycCase.latestScreeningRun.hits.map((h: any) => ({
            id: h.id, matchedName: h.matchedName, matchedTopics: h.matchedTopics, reviewStatus: h.reviewStatus,
          })),
        } : null,
      } : null,
    })),
    reviewTasks: f.reviewTasks.map((t: any) => ({
      id: t.id, kind: t.kind, dueAt: t.dueAt?.toISOString() ?? null,
      assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
    })),
  };
}
