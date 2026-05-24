import { prisma } from "@/lib/db";
import { runScreening } from "@/lib/services/compliance/screening";
import { diffHitsForAlert } from "@/lib/services/compliance/hit-dedup";
import { logActivity } from "@/lib/services/activity";

const CADENCE_DAYS = { high: 30, standard: 90, low: 365 };

export async function autoRescreenTick() {
  const start = Date.now();
  const cutoff = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const due = await prisma.kycCase.findMany({
    where: {
      state: "passed",
      party: { complianceFile: { riskRating: { not: null }, status: "cleared" } },
      OR: [
        { latestScreeningRun: { is: null } },
        { latestScreeningRun: { ranAt: { lt: cutoff(365) } } }, // floor; refined per case below
      ],
    },
    include: {
      party: { include: { complianceFile: true } },
      latestScreeningRun: { include: { hits: true } },
    },
    take: 100,
  });

  let created = 0;
  for (const kyc of due) {
    const rating = kyc.party.complianceFile.riskRating ?? "low";
    const cutoffForBand = cutoff(CADENCE_DAYS[rating as keyof typeof CADENCE_DAYS]);
    if (kyc.latestScreeningRun && kyc.latestScreeningRun.ranAt >= cutoffForBand) continue;

    try {
      const previousHits = (kyc.latestScreeningRun?.hits ?? []).map((h) => ({
        externalId: h.externalId, topics: h.matchedTopics,
      }));
      const run = await runScreening(kyc.id, { actorId: null });
      if (run.outcome === "error") continue;

      const newRun = await prisma.screeningRun.findUnique({
        where: { id: run.id },
        include: { hits: true },
      });
      const currentHits = (newRun?.hits ?? []).map((h) => ({
        externalId: h.externalId, topics: h.matchedTopics,
      }));
      if (diffHitsForAlert(previousHits, currentHits)) {
        // Don't dupe — if staff hasn't reviewed the previous screening_hit task,
        // re-firing on each tick would spam the queue. One open task per file.
        const existing = await prisma.reviewTask.findFirst({
          where: { complianceFileId: kyc.party.complianceFileId, kind: "screening_hit", state: "open" },
          select: { id: true },
        });
        if (!existing) {
          await prisma.reviewTask.create({
            data: {
              complianceFileId: kyc.party.complianceFileId,
              kind: "screening_hit",
              dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              note: `New/changed hits for ${kyc.party.fullName}`,
            },
          });
          await logActivity({
            entityType: "compliance_file", entityId: kyc.party.complianceFileId,
            action: "compliance.review_task_created",
            meta: { kind: "screening_hit", kycCaseId: kyc.id },
          });
          created += 1;
        }
      }
      await new Promise((r) => setTimeout(r, 250)); // throttle
    } catch (e) {
      console.error("[auto-rescreen] kycCaseId=%s error=%s", kyc.id, (e as Error).message);
    }
  }
  console.log("[auto-rescreen] checked=%d tasksCreated=%d durationMs=%d", due.length, created, Date.now() - start);
}
