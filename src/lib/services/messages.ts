import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { email } from "@/lib/providers/email";
import { getServerBranding } from "@/lib/services/branding-server";

export interface SendMessageInput {
  clientId: string;
  senderId: string;
  body: string;
}

export async function sendMessage(input: SendMessageInput) {
  if (input.body.trim().length === 0) throw new Error("Message body required");

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    include: { user: { select: { email: true, fullName: true } } },
  });
  if (!client) throw new Error("Client not found");

  const msg = await prisma.message.create({
    data: { clientId: input.clientId, senderId: input.senderId, body: input.body },
  });

  try {
    const { brandName } = await getServerBranding();
    await email().send({
      to: client.user.email,
      subject: `New message from ${brandName}`,
      html: `<p>${escapeHtml(input.body).replace(/\n/g, "<br/>")}</p><p style="color:#888">Reply to this email to respond.</p>`,
    });
  } catch (e) {
    console.error("[sendMessage] email failed:", (e as Error).message);
  }

  await logActivity({
    entityType: "message", entityId: msg.id,
    action: "message.sent", actorId: input.senderId,
    meta: { clientId: input.clientId },
  });

  return msg;
}

export async function listThread(clientId: string) {
  return prisma.message.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
