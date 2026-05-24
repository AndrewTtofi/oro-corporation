import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";
import { recomputeAndStoreRisk } from "@/lib/services/compliance/risk-persist";

export const dynamic = "force-dynamic";

export default async function SubmissionCompliancePage({ params }: { params: Promise<{ ref: string }> }) {
  await requireRole("staff");
  const { ref } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { OR: [{ id: ref }, { referenceNumber: ref }] },
    include: { complianceFile: { include: {
      parties: { include: { kycCase: { include: { latestScreeningRun: { include: { hits: true } } } } } },
      reviewTasks: { where: { state: "open" }, include: { assignedTo: true } },
    } } },
  });
  if (!prospect?.complianceFile) notFound();
  if (!prospect.complianceFile.riskComputed) await recomputeAndStoreRisk(prospect.complianceFile.id, null);
  const file: any = prospect.complianceFile;
  return (
    <AdminShell active="submissions">
      <ComplianceDashboard file={{
        ...file,
        signedOffAt: file.signedOffAt?.toISOString() ?? null,
        parties: file.parties.map((p: any) => ({
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
        reviewTasks: file.reviewTasks.map((t: any) => ({
          id: t.id, kind: t.kind, dueAt: t.dueAt?.toISOString() ?? null,
          assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
        })),
      }} parentLink={`/admin/submissions/${ref}/compliance`} />
    </AdminShell>
  );
}
