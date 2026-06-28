import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole, isSuperAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour");

const schema = z.object({
  displayName: z.string().min(1).max(150).optional(),
  contactEmail: z.string().email().or(z.literal("")).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  // Onboarding document-upload phase behaviour
  documentsPhase: z.enum(["mandatory", "optional", "off"]).optional(),
  // White-label branding + plan tier
  brandName: z.string().max(150).nullable().optional(),
  brandMark: z.string().max(2).nullable().optional(),
  // Logo as a data: URL (png/jpeg/svg/webp), capped ~1MB of base64. "" clears it.
  logo: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);/, "Must be a PNG, JPEG, WEBP or SVG image")
    .max(1_400_000, "Image too large — keep it under ~1MB")
    .or(z.literal(""))
    .nullable()
    .optional(),
  accentColor: hex.or(z.literal("")).nullable().optional(),
  themePreset: z.enum(["indigo", "emerald", "gold", "burgundy", "slate"]).optional(),
  planTier: z.enum(["starter", "professional", "scale"]).optional(),
});

export async function PATCH(req: Request) {
  const user = await assertRole("staff");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const p = parsed.data;

  // The plan tier is operator-controlled: only a super admin may change it.
  if (p.planTier !== undefined && !isSuperAdmin(user)) {
    return NextResponse.json({ error: "Only a super admin can change the plan tier." }, { status: 403 });
  }

  // Only persist keys that were actually sent, so the organization and branding
  // forms can each PATCH their own subset without clobbering the other.
  const data: Record<string, unknown> = {};
  if (p.displayName !== undefined) data.displayName = p.displayName;
  if (p.contactEmail !== undefined) data.contactEmail = p.contactEmail || null;
  if (p.address !== undefined) data.address = p.address || null;
  if (p.documentsPhase !== undefined) data.documentsPhase = p.documentsPhase;
  if (p.brandName !== undefined) data.brandName = p.brandName || null;
  if (p.brandMark !== undefined) data.brandMark = p.brandMark ? p.brandMark.toUpperCase() : null;
  if (p.logo !== undefined) data.logo = p.logo || null;
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
