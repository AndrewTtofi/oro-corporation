import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { addParty } from "@/lib/services/compliance/parties";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["individual", "entity"]),
  role: z.enum(["main_contact", "ubo", "director", "shareholder", "signatory", "intermediary"]),
  fullName: z.string().min(2).max(150),
  dateOfBirth: z.string().date().optional().nullable(),
  nationality: z.string().length(2).optional().nullable(),
  countryOfResidence: z.string().length(2).optional().nullable(),
  passportNumber: z.string().max(40).optional().nullable(),
  registrationNumber: z.string().max(60).optional().nullable(),
  jurisdiction: z.string().length(2).optional().nullable(),
  ownershipPct: z.coerce.number().min(0).max(100).optional().nullable(),
  isPep: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const p = await addParty(id, body.data, me.id);
  return NextResponse.json({ ok: true, id: p.id });
}
