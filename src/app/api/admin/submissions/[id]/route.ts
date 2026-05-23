import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { setSubmissionStatus } from "@/lib/services/submissions";
import { prisma } from "@/lib/db";
import { ProspectStatus } from "@prisma/client";

export const runtime = "nodejs";

const schema = z.object({
  status: z.nativeEnum(ProspectStatus),
  note: z.string().max(5000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await assertRole("staff");
  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { OR: [{ id }, { referenceNumber: id }] },
  });
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const updated = await setSubmissionStatus({
    prospectId: prospect.id,
    actorId: user.id,
    status: parsed.data.status,
    note: parsed.data.note,
  });
  return NextResponse.json({ ok: true, status: updated.status });
}
