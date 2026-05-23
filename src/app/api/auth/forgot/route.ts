import { NextResponse } from "next/server";
import { forgotSchema } from "@/lib/schema/auth";
import { startPasswordReset } from "@/lib/services/auth-flows";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = ipOf(req);
  const limit = await rateLimit({ bucket: "forgot", key: ip, limit: 5, windowSec: 600 });
  if (!limit.ok) return NextResponse.json({ ok: true }); // silent — don't leak rate-limited

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });

  await startPasswordReset(parsed.data.email);
  return NextResponse.json({ ok: true });
}

function ipOf(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}
