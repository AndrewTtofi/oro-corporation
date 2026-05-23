import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
const schema = z.object({ partnerId: z.string().uuid().nullable() });

/** Persist the prospect↔partner assignment as the partner's `assignedPartnerId`
 *  on each underlying ClientService once the prospect is converted. Until then,
 *  we stash it on the prospect's draft JSON under `__assignedPartnerId`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertRole("staff");
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const prospect = await prisma.prospect.findFirst({
    where: { OR: [{ id }, { referenceNumber: id }] },
  });
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draft = (prospect.draft as Record<string, unknown> | null) ?? {};
  draft.__assignedPartnerId = parsed.data.partnerId;
  await prisma.prospect.update({ where: { id: prospect.id }, data: { draft: draft as never } });
  return NextResponse.json({ ok: true });
}
