import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { fullDraftSchema } from "@/lib/schema/onboarding";
import { saveDraft } from "@/lib/services/onboarding";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff");
  const limit = await rateLimit({ bucket: "draft", key: user.id, limit: 60, windowSec: 60 });
  if (!limit.ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const parsed = fullDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }
  await saveDraft(user.id, parsed.data);
  return NextResponse.json({ ok: true });
}
