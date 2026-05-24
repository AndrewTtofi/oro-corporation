import { prisma } from "@/lib/db";
import type { KeyDateStatus } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface UpdateKeyDateInput {
  description?: string;
  dueDate?: string; // ISO date
  status?: KeyDateStatus;
}

export async function updateKeyDate(keyDateId: string, patch: UpdateKeyDateInput, actorId: string) {
  const kd = await prisma.keyDate.findUnique({ where: { id: keyDateId }, select: { clientId: true } });
  if (!kd) throw new Error("Key date not found");

  const data: Record<string, unknown> = {};
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.dueDate !== undefined) data.dueDate = new Date(patch.dueDate);
  if (patch.status !== undefined) data.status = patch.status;

  await prisma.keyDate.update({ where: { id: keyDateId }, data });

  const action = patch.status === "completed" ? "client.key_date_completed" : "client.key_date_updated";
  await logActivity({
    entityType: "client", entityId: kd.clientId,
    action, actorId,
    meta: { keyDateId, ...patch },
  });
}

export async function deleteKeyDate(keyDateId: string, actorId: string) {
  const kd = await prisma.keyDate.findUnique({ where: { id: keyDateId }, select: { clientId: true } });
  if (!kd) throw new Error("Key date not found");
  await prisma.keyDate.delete({ where: { id: keyDateId } });
  await logActivity({
    entityType: "client", entityId: kd.clientId,
    action: "client.key_date_deleted", actorId,
    meta: { keyDateId },
  });
}
