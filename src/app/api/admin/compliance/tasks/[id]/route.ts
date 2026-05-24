import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export const runtime = "nodejs";

const schema = z.object({
  state: z.enum(["completed", "dismissed"]),
  note: z.string().max(2000).optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const task = await prisma.reviewTask.update({
    where: { id },
    data: {
      state: body.data.state,
      completedAt: new Date(),
      ...(body.data.note !== undefined && { note: body.data.note }),
    },
  });
  await logActivity({
    entityType: "review_task", entityId: id,
    action: "compliance.review_task_completed", actorId: me.id,
    meta: { state: body.data.state, complianceFileId: task.complianceFileId },
  });
  return NextResponse.json({ ok: true });
}
