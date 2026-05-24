import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { recomputeAndStoreRisk } from "@/lib/services/compliance/risk-persist";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const result = await recomputeAndStoreRisk(id, me.id);
  return NextResponse.json({ ok: true, result });
}
