import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  completeness: z.enum(["low", "med", "high"]).nullable(),
});

/** Staff override of the auto-computed brief-completeness score. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertRole("staff");
  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({ where: { OR: [{ id }, { referenceNumber: id }] } });
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { completenessOverride: parsed.data.completeness },
  });
  return NextResponse.json({ ok: true });
}
