import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(40).optional(),
  languagePref: z.enum(["en", "ru"]),
});

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff", "partner");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      languagePref: parsed.data.languagePref,
    },
  });
  return NextResponse.json({ ok: true });
}
