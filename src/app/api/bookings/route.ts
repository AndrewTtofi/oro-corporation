import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { createBooking } from "@/lib/services/booking";

export const runtime = "nodejs";

const schema = z.object({
  expertId: z.string().uuid(),
  startUtc: z.coerce.date(),
  timezone: z.string().min(3),
});

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const out = await createBooking({
    userId: user.id,
    expertId: parsed.data.expertId,
    startUtc: parsed.data.startUtc,
    timezone: parsed.data.timezone,
  });
  if (!out.ok) {
    const status = out.reason === "SLOT_TAKEN" ? 409 : out.reason === "NOT_APPROVED" ? 403 : 400;
    return NextResponse.json({ error: out.reason }, { status });
  }
  return NextResponse.json({
    ok: true,
    booking: { id: out.booking.id, startsAt: out.booking.startsAt, expert: out.booking.expert.fullName },
  });
}
