import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { email } from "@/lib/providers/email";

export async function getMessagesForUser(userId: string) {
  const [prospect, client] = await Promise.all([
    prisma.prospect.findUnique({ where: { userId }, select: { id: true } }),
    prisma.client.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  const orClauses: { prospectId?: string; clientId?: string }[] = [];
  if (prospect) orClauses.push({ prospectId: prospect.id });
  if (client) orClauses.push({ clientId: client.id });
  if (orClauses.length === 0) return [];
  return prisma.message.findMany({
    where: { OR: orClauses },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });
}

export async function sendClientMessage(userId: string, body: string) {
  if (!body || body.trim().length === 0) throw new Error("Message body required");

  const client = await prisma.client.findUnique({
    where: { userId },
    include: { primaryStaff: { select: { email: true, fullName: true } } },
  });
  let prospect: { id: string; reviewedBy?: { email: string } | null } | null = null;
  if (!client) {
    prospect = await prisma.prospect.findUnique({
      where: { userId },
      include: { reviewedBy: { select: { email: true } } },
    });
    if (!prospect) throw new Error("No prospect or client for user");
  }

  const data: { senderId: string; body: string; clientId?: string; prospectId?: string } = {
    senderId: userId, body,
  };
  if (client) data.clientId = client.id;
  else data.prospectId = prospect!.id;

  const msg = await prisma.message.create({ data });

  const recipient = client?.primaryStaff?.email ?? prospect?.reviewedBy?.email ?? null;
  if (recipient) {
    try {
      await email().send({
        to: recipient,
        subject: "New message from client",
        html: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`,
      });
    } catch (e) {
      console.error("[sendClientMessage] email failed:", (e as Error).message);
    }
  }

  await logActivity({
    entityType: "message", entityId: msg.id,
    action: "message.sent", actorId: userId,
    meta: { side: "client", clientId: client?.id, prospectId: prospect?.id },
  });

  return msg;
}

export interface SelfProfilePatch {
  fullName?: string;
  phone?: string | null;
  languagePref?: "en" | "ru";
  address?: string | null;
  taxResidency?: string | null;
}

const ALLOWED_USER_FIELDS = new Set(["fullName", "phone", "languagePref"]);
const ALLOWED_CLIENT_FIELDS = new Set(["address", "taxResidency"]);
const ALLOWED_FIELDS = new Set([...ALLOWED_USER_FIELDS, ...ALLOWED_CLIENT_FIELDS]);

export async function updateClientSelfProfile(userId: string, patch: SelfProfilePatch) {
  for (const k of Object.keys(patch)) {
    if (!ALLOWED_FIELDS.has(k)) throw new Error(`Unknown field: ${k}`);
  }

  const userData: Record<string, unknown> = {};
  if (patch.fullName !== undefined) userData.fullName = patch.fullName;
  if (patch.phone !== undefined) userData.phone = patch.phone;
  if (patch.languagePref !== undefined) userData.languagePref = patch.languagePref;

  const clientData: Record<string, unknown> = {};
  if (patch.address !== undefined) clientData.address = patch.address;
  if (patch.taxResidency !== undefined) clientData.taxResidency = patch.taxResidency;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: userId }, data: userData });
    }
    if (Object.keys(clientData).length > 0) {
      const client = await tx.client.findUnique({ where: { userId }, select: { id: true } });
      if (client) {
        await tx.client.update({ where: { id: client.id }, data: clientData });
      }
    }
  });

  await logActivity({
    entityType: "user", entityId: userId,
    action: "client.self_profile_updated", actorId: userId,
    meta: { fieldsChanged: Object.keys(patch) },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
