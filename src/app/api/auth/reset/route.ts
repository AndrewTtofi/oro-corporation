import { NextResponse } from "next/server";
import { resetSchema } from "@/lib/schema/auth";
import { completePasswordReset } from "@/lib/services/auth-flows";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit({ bucket: "forgot", key: ip, limit: 10, windowSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 422 });
  }
  const result = await completePasswordReset(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason === "EXPIRED" ? "This link has expired." : "Invalid reset link." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
