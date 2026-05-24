import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateParty, removeParty } from "@/lib/services/compliance/parties";

export const runtime = "nodejs";

const patchSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  nationality: z.string().length(2).optional().nullable(),
  countryOfResidence: z.string().length(2).optional().nullable(),
  passportNumber: z.string().max(40).optional().nullable(),
  registrationNumber: z.string().max(60).optional().nullable(),
  jurisdiction: z.string().length(2).optional().nullable(),
  ownershipPct: z.coerce.number().min(0).max(100).optional().nullable(),
  isPep: z.boolean().optional(),
  role: z.enum(["main_contact", "ubo", "director", "shareholder", "signatory", "intermediary"]).optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  await updateParty(id, body.data, me.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  try {
    await removeParty(id, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
