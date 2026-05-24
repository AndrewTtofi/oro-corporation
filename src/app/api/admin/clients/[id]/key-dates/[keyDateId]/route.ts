import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateKeyDate, deleteKeyDate } from "@/lib/services/key-dates";

export const runtime = "nodejs";

const patchSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  dueDate: z.string().date().optional(),
  status: z.enum(["upcoming", "overdue", "completed"]).optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; keyDateId: string }> }) {
  const me = await assertRole("staff");
  const { keyDateId } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  await updateKeyDate(keyDateId, body.data, me.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; keyDateId: string }> }) {
  const me = await assertRole("staff");
  const { keyDateId } = await params;
  await deleteKeyDate(keyDateId, me.id);
  return NextResponse.json({ ok: true });
}
