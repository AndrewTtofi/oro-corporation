import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export const runtime = "nodejs";

const schema = z.object({
  prospectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  body: z.string().min(1).max(5000),
});

/** Staff + partners can write internal notes. Partners can only write on clients
 *  they are assigned to. */
export async function POST(req: Request) {
  const user = await assertRole("staff", "partner");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  if (!parsed.data.prospectId && !parsed.data.clientId) {
    return NextResponse.json({ error: "prospectId or clientId required" }, { status: 422 });
  }

  if (user.role === "partner") {
    if (parsed.data.prospectId) {
      // Partners can't see raw prospects until conversion.
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const link = await prisma.clientService.findFirst({
      where: { clientId: parsed.data.clientId!, assignedPartnerId: user.id },
      select: { id: true },
    });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const note = await prisma.internalNote.create({
    data: {
      prospectId: parsed.data.prospectId,
      clientId: parsed.data.clientId,
      authorId: user.id,
      body: parsed.data.body,
    },
  });
  await logActivity({
    entityType: parsed.data.clientId ? "client" : "prospect",
    entityId: parsed.data.clientId ?? parsed.data.prospectId!,
    action: "note.added",
    actorId: user.id,
  });
  return NextResponse.json({ ok: true, id: note.id });
}
