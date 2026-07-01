import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/schema/auth";
import { registerProspect } from "@/lib/services/auth-flows";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = await rateLimit({ bucket: "register", key: ipOf(req), limit: 5, windowSec: 600 });
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((e) => e.message).join(", ") },
      { status: 422 },
    );
  }

  const result = await registerProspect(parsed.data);
  if (!result.ok) {
    // Generic message — do not leak existence
    return NextResponse.json(
      { error: "If that email is available, we've sent a verification link." },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true });
}

function ipOf(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
