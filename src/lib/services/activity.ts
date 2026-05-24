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
  | "booking.cancelled"
  | "user.email_verified"
  | "compliance.file_created"
  | "compliance.party_added"
  | "compliance.party_removed"
  | "compliance.idv_verified"
  | "compliance.idv_failed"
  | "compliance.screening_run"
  | "compliance.hit_reviewed"
  | "compliance.risk_assessed"
  | "compliance.risk_overridden"
  | "compliance.signed_off"
  | "compliance.blocked"
  | "compliance.review_task_created"
  | "compliance.review_task_completed";

export async function logActivity(args: {
  entityType: "prospect" | "client" | "document" | "booking" | "user"
    | "compliance_file" | "party" | "kyc_case" | "screening_run" | "review_task";
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
