import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

const CADENCE_DAYS = { high: 180, standard: 365, low: 730 };

export async function periodicReviewTick() {
  const start = Date.now();
  const files = await prisma.complianceFile.findMany({
    where: { status: "cleared", riskRating: { not: null } },
    select: { id: true, riskRating: true, reviewTasks: { where: { kind: "periodic_review" } } },
  });

  let created = 0;
  for (const f of files) {
    try {
      const openExists = f.reviewTasks.some((t) => t.state === "open");
      if (openExists) continue;
      const lastDone = f.reviewTasks
        .filter((t) => t.state === "completed")
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0];
      const cadence = CADENCE_DAYS[f.riskRating as keyof typeof CADENCE_DAYS];
      const since = lastDone?.completedAt ?? null;
      const due = since ? since.getTime() < Date.now() - cadence * 86400000 : true;
      if (!due) continue;

      await prisma.reviewTask.create({
        data: {
          complianceFileId: f.id,
          kind: "periodic_review",
          dueAt: new Date(Date.now() + 14 * 86400000),
        },
      });
      await logActivity({
        entityType: "compliance_file", entityId: f.id,
        action: "compliance.review_task_created",
        meta: { kind: "periodic_review" },
      });
      created += 1;
    } catch (e) {
      console.error("[periodic-review] fileId=%s error=%s", f.id, (e as Error).message);
    }
  }
  console.log("[periodic-review] checked=%d tasksCreated=%d durationMs=%d", files.length, created, Date.now() - start);
}
