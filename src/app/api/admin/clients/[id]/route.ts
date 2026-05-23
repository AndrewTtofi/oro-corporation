import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { ClientStatus } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export const runtime = "nodejs";

const schema = z.object({ status: z.nativeEnum(ClientStatus) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await assertRole("staff");
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const updated = await prisma.client.update({ where: { id }, data: { status: parsed.data.status } });
  await logActivity({
    entityType: "client",
    entityId: id,
    action: "client.status_changed",
    actorId: user.id,
    meta: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true, status: updated.status });
}
