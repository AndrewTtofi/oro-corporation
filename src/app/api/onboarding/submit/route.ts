import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { submitSchema } from "@/lib/schema/onboarding";
import { commitFormAnswers, submitProspect } from "@/lib/services/onboarding";

export const runtime = "nodejs";

/** Step-2 commit (also valid when reached from "Save & continue" on Step 3). */
export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff");
  const body = await req.json().catch(() => ({}));
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }
  const out = await commitFormAnswers(user.id, parsed.data);
  if (!out.ok) return NextResponse.json({ error: out.errors }, { status: 422 });
  return NextResponse.json({ ok: true, prospect: { id: out.prospect.id, reference: out.prospect.referenceNumber } });
}

/** Step-3 final submit — verifies documents present, locks status to pending. */
export async function PUT() {
  const user = await assertRole("prospect", "client", "staff");
  const out = await submitProspect(user.id);
  if (!out.ok) return NextResponse.json({ error: out.reason }, { status: 422 });
  return NextResponse.json({ ok: true, reference: out.prospect.referenceNumber });
}
