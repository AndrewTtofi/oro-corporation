import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { saveServicesSelection } from "@/lib/services/onboarding";
import { SERVICE_KEYS } from "@/lib/schema/onboarding";

const schema = z.object({ services: z.array(z.enum(SERVICE_KEYS)).min(1) });

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid services" }, { status: 422 });
  await saveServicesSelection(user.id, parsed.data.services);
  return NextResponse.json({ ok: true });
}
