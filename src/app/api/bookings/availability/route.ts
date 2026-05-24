import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { listAvailability, listExperts } from "@/lib/services/booking";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await assertRole("prospect", "client", "staff");
  const url = new URL(req.url);
  const expertId = url.searchParams.get("expertId");
  const tz = url.searchParams.get("tz") || "Europe/Nicosia";

  if (!expertId) {
    const experts = await listExperts();
    return NextResponse.json({ experts });
  }

  // Don't reveal expert availability unless the requester is approved (or staff).
  if (user.role !== "staff") {
    const prospect = await prisma.prospect.findUnique({ where: { userId: user.id } });
    if (prospect?.status !== "approved") {
      return NextResponse.json({ error: "Not approved" }, { status: 403 });
    }
  }

  const availability = await listAvailability(expertId, tz);
  return NextResponse.json(availability);
}
