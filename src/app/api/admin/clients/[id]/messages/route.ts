import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { sendMessage, listThread } from "@/lib/services/messages";

export const runtime = "nodejs";

const schema = z.object({ body: z.string().min(1).max(10000) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertRole("staff");
  const { id } = await params;
  const messages = await listThread(id);
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const msg = await sendMessage({ clientId: id, senderId: me.id, body: body.data.body });
  return NextResponse.json({ ok: true, id: msg.id });
}
