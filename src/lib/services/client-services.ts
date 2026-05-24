import { prisma } from "@/lib/db";
import type { SvcStatus } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface AddClientServiceInput {
  serviceType: string;
  assignedPartnerId?: string | null;
  startDate?: string | null;
  notes?: string | null;
}

export async function addClientService(clientId: string, input: AddClientServiceInput, actorId: string) {
  const created = await prisma.clientService.create({
    data: {
      clientId,
      serviceType: input.serviceType,
      assignedPartnerId: input.assignedPartnerId ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      notes: input.notes ?? null,
    },
  });
  await logActivity({
    entityType: "client", entityId: clientId,
    action: "client.service_added", actorId,
    meta: { serviceType: input.serviceType, clientServiceId: created.id },
  });
  return created;
}

export interface UpdateClientServiceInput {
  status?: SvcStatus;
  assignedPartnerId?: string | null;
  startDate?: string | null;
  notes?: string | null;
}

export async function updateClientService(serviceId: string, patch: UpdateClientServiceInput, actorId: string) {
  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.assignedPartnerId !== undefined) data.assignedPartnerId = patch.assignedPartnerId;
  if (patch.startDate !== undefined) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.notes !== undefined) data.notes = patch.notes;

  const updated = await prisma.clientService.update({ where: { id: serviceId }, data });
  await logActivity({
    entityType: "client", entityId: updated.clientId,
    action: "client.service_updated", actorId,
    meta: { clientServiceId: serviceId, ...patch },
  });
}

export async function removeClientService(serviceId: string, actorId: string) {
  const cs = await prisma.clientService.findUnique({ where: { id: serviceId }, select: { clientId: true, serviceType: true } });
  if (!cs) throw new Error("Service not found");
  await prisma.clientService.delete({ where: { id: serviceId } });
  await logActivity({
    entityType: "client", entityId: cs.clientId,
    action: "client.service_removed", actorId,
    meta: { clientServiceId: serviceId, serviceType: cs.serviceType },
  });
}
