import { prisma } from "@/lib/db";
import { ProspectStatus } from "@prisma/client";
import { logActivity } from "./activity";
import { notify } from "@/lib/providers/notify";
import { allocateReferenceNumber } from "./reference";
import { checkComplianceGateForProspect } from "@/lib/services/compliance/gate";

export async function setSubmissionStatus(args: {
  prospectId: string;
  actorId: string;
  status: ProspectStatus;
  note?: string;
  partnerId?: string | null;
}) {
  const updated = await prisma.prospect.update({
    where: { id: args.prospectId },
    data: {
      status: args.status,
      reviewedAt: new Date(),
      reviewedById: args.actorId,
    },
    include: { user: true },
  });

  await logActivity({
    entityType: "prospect",
    entityId: updated.id,
    action: args.status === "approved"
      ? "submission.approved"
      : args.status === "rejected"
        ? "submission.rejected"
        : args.status === "needs_info"
          ? "submission.info_requested"
          : "submission.status_changed",
    actorId: args.actorId,
    meta: { status: args.status, note: args.note },
  });

  if (args.note) {
    await prisma.internalNote.create({
      data: {
        prospectId: updated.id,
        authorId: args.actorId,
        body: args.note,
      },
    });
  }

  // Best-effort email — never block the API on delivery.
  await notify().send({
    channel: "email",
    to: updated.user.email,
    template: "submission-update",
    data: { reference: updated.referenceNumber, status: args.status, note: args.note ?? "" },
  }).catch(() => undefined);

  return updated;
}

/** Convert an approved prospect to a Client. One-click; idempotent. */
export async function convertProspectToClient(args: {
  prospectId: string;
  actorId: string;
  primaryStaffId?: string;
}) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: args.prospectId },
    include: { user: true, client: true },
  });
  if (!prospect) return { ok: false as const, reason: "NOT_FOUND" as const };
  if (prospect.status !== "approved") return { ok: false as const, reason: "NOT_APPROVED" as const };
  if (prospect.client) return { ok: true as const, client: prospect.client };

  const gate = await checkComplianceGateForProspect(args.prospectId);
  if (!gate.ok) {
    throw Object.assign(new Error("COMPLIANCE_GATE_FAILED"), { reason: gate.reason });
  }

  const primaryStaffId = args.primaryStaffId ?? args.actorId;

  const client = await prisma.$transaction(async (tx) => {
    const c = await tx.client.create({
      data: {
        userId: prospect.userId,
        prospectId: prospect.id,
        primaryStaffId,
      },
    });
    await tx.user.update({ where: { id: prospect.userId }, data: { role: "client" } });
    const services = Array.isArray(prospect.servicesSelected) ? (prospect.servicesSelected as string[]) : [];
    if (services.length) {
      await tx.clientService.createMany({
        data: services.map((s) => ({
          clientId: c.id,
          serviceType: s,
          status: "pending",
        })),
      });
    }
    return c;
  });

  await prisma.complianceFile.update({
    where: { prospectId: args.prospectId },
    data: { clientId: client.id },
  });

  await logActivity({
    entityType: "client",
    entityId: client.id,
    action: "client.created",
    actorId: args.actorId,
    meta: { fromProspect: prospect.referenceNumber },
  });

  return { ok: true as const, client };
}

/** Allocate a new reference number off-cycle (used for tests/admin actions). */
export async function freshReference() {
  return allocateReferenceNumber();
}
