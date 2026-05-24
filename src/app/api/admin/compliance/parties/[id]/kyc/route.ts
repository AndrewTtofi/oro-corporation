import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateKycCase } from "@/lib/services/compliance/parties";

export const runtime = "nodejs";

const schema = z.object({
  idvStatus: z.enum(["pending", "verified", "failed"]).optional(),
  idvNote: z.string().max(2000).nullable().optional(),
  passportDocId: z.string().uuid().nullable().optional(),
  proofOfAddressDocId: z.string().uuid().nullable().optional(),
  sofDocId: z.string().uuid().nullable().optional(),
  sofNote: z.string().max(2000).nullable().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  if (body.data.idvStatus === "failed" && !body.data.idvNote) {
    return NextResponse.json({ error: "Failure requires a note" }, { status: 422 });
  }
  await updateKycCase(id, body.data, me.id);
  return NextResponse.json({ ok: true });
}
