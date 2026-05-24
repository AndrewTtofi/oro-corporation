import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { runScreening } from "@/lib/services/compliance/screening";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const kyc = await prisma.kycCase.findUnique({ where: { partyId: id }, select: { id: true } });
  if (!kyc) return NextResponse.json({ error: "KycCase not found" }, { status: 404 });
  const run = await runScreening(kyc.id, { actorId: me.id });
  return NextResponse.json({ ok: true, runId: run.id, outcome: run.outcome, hitCount: run.hitCount });
}
