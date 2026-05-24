import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff", "partner");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash) {
    return NextResponse.json({ error: "Password sign-in not configured" }, { status: 400 });
  }
  const ok = await argon2.verify(dbUser.passwordHash, parsed.data.currentPassword);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  return NextResponse.json({ ok: true });
}
