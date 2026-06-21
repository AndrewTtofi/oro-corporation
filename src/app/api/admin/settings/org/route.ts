import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour");

const schema = z.object({
  displayName: z.string().min(1).max(150).optional(),
  contactEmail: z.string().email().or(z.literal("")).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  // White-label branding + plan tier
  brandName: z.string().max(150).nullable().optional(),
  brandMark: z.string().max(2).nullable().optional(),
  accentColor: hex.or(z.literal("")).nullable().optional(),
  themePreset: z.enum(["indigo", "emerald", "gold", "burgundy", "slate"]).optional(),
  planTier: z.enum(["starter", "professional", "scale"]).optional(),
});

export async function PATCH(req: Request) {
  await assertRole("staff");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const p = parsed.data;

  // Only persist keys that were actually sent, so the organization and branding
  // forms can each PATCH their own subset without clobbering the other.
  const data: Record<string, unknown> = {};
  if (p.displayName !== undefined) data.displayName = p.displayName;
  if (p.contactEmail !== undefined) data.contactEmail = p.contactEmail || null;
  if (p.address !== undefined) data.address = p.address || null;
  if (p.brandName !== undefined) data.brandName = p.brandName || null;
  if (p.brandMark !== undefined) data.brandMark = p.brandMark ? p.brandMark.toUpperCase() : null;
  if (p.accentColor !== undefined) data.accentColor = p.accentColor || null;
  if (p.themePreset !== undefined) data.themePreset = p.themePreset;
  if (p.planTier !== undefined) data.planTier = p.planTier;

  await prisma.orgSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json({ ok: true });
}
