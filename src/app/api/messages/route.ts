import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  body: z.string().min(1).max(5000),
  prospectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

/** Send a message in a prospect/client thread. Server-side authorization:
 *  - prospect/client owner can only post on their own thread
 *  - staff can post on any thread
 *  - partner can post on threads of clients they're assigned to
 */
export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff", "partner");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  if (!parsed.data.prospectId && !parsed.data.clientId) {
    return NextResponse.json({ error: "prospectId or clientId required" }, { status: 422 });
  }

  if (parsed.data.prospectId) {
    const prospect = await prisma.prospect.findUnique({ where: { id: parsed.data.prospectId } });
    if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "staff" && prospect.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else if (parsed.data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "client" && client.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (user.role === "partner") {
      const link = await prisma.clientService.findFirst({
        where: { clientId: client.id, assignedPartnerId: user.id },
        select: { id: true },
      });
      if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const msg = await prisma.message.create({
    data: {
      prospectId: parsed.data.prospectId,
      clientId: parsed.data.clientId,
      senderId: user.id,
      body: parsed.data.body,
    },
  });
  return NextResponse.json({ ok: true, id: msg.id });
}
