import { prisma } from "@/lib/db";

export type ActivityAction =
  | "submission.created"
  | "submission.draft_saved"
  | "submission.submitted"
  | "submission.status_changed"
  | "submission.approved"
  | "submission.rejected"
  | "submission.info_requested"
  | "client.created"
  | "client.status_changed"
  | "client.service_added"
  | "client.key_date_added"
  | "document.uploaded"
  | "document.viewed"
  | "document.status_changed"
  | "note.added"
  | "booking.created"
  | "booking.reminder_sent"
  | "booking.cancelled";

export async function logActivity(args: {
  entityType: "prospect" | "client" | "document" | "booking";
  entityId: string;
  action: ActivityAction;
  actorId?: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      actorId: args.actorId,
      meta: args.meta as never,
    },
  });
}
