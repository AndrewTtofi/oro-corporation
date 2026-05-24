import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { overrideRiskRating } from "@/lib/services/compliance/risk-persist";

export const runtime = "nodejs";

const schema = z.object({
  rating: z.enum(["low", "standard", "high"]),
  reason: z.string().min(5).max(2000),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    await overrideRiskRating(id, body.data.rating, body.data.reason, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
