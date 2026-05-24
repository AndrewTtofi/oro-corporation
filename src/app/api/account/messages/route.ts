import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { sendClientMessage } from "@/lib/services/client-portal";

export const runtime = "nodejs";

const schema = z.object({ body: z.string().min(1).max(10000) });

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client");
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    const msg = await sendClientMessage(user.id, body.data.body);
    return NextResponse.json({ ok: true, id: msg.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
