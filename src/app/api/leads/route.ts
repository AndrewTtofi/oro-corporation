import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertLead } from "@/lib/services/leads";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(150).optional().nullable(),
  serviceKey: z.string().max(60).optional().nullable(),
  source: z.enum(["calculator", "intake", "manual"]).default("calculator"),
  note: z.string().max(300).optional().nullable(),
});

/** Public lead capture — tax-calculator reveals and other front-funnel forms. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const rl = await rateLimit({ bucket: "lead", key: ip, limit: 20, windowSec: 3600 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  await upsertLead(parsed.data);
  return NextResponse.json({ ok: true });
}
