import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { convertProspectToClient } from "@/lib/services/submissions";

export const runtime = "nodejs";

const schema = z.object({
  prospectId: z.string(),
  primaryStaffId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const user = await assertRole("staff");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  let out;
  try {
    out = await convertProspectToClient({
      prospectId: parsed.data.prospectId,
      actorId: user.id,
      primaryStaffId: parsed.data.primaryStaffId,
    });
  } catch (e) {
    const err = e as { message?: string; reason?: string };
    if (err.message === "COMPLIANCE_GATE_FAILED") {
      return NextResponse.json({ error: err.reason ?? "compliance_not_cleared" }, { status: 409 });
    }
    throw e;
  }
  if (!out.ok) {
    return NextResponse.json({ error: out.reason }, { status: out.reason === "NOT_APPROVED" ? 422 : 404 });
  }
  return NextResponse.json({ ok: true, clientId: out.client.id });
}
