import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getOrgSettings } from "@/lib/services/settings";
import { getBranding, tierAtLeast, type PlanTier } from "@/lib/services/branding";
import { DASHBOARD_SECTIONS, DASHBOARD_SECTION_KEYS, type DashboardSectionKey } from "@/lib/services/dashboard-sections";

export const runtime = "nodejs";

const schema = z.object({
  key: z.enum(DASHBOARD_SECTION_KEYS as [DashboardSectionKey, ...DashboardSectionKey[]]),
  enabled: z.boolean(),
});

export async function PATCH(req: Request) {
  await assertRole("staff");
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const { key, enabled } = parsed.data;

  // A section above the firm's plan tier cannot be enabled.
  if (enabled) {
    const section = DASHBOARD_SECTIONS.find((s) => s.key === key)!;
    const { planTier } = await getBranding();
    if (!tierAtLeast(planTier, section.minTier as PlanTier)) {
      return NextResponse.json({ error: `Requires the ${section.minTier} plan.` }, { status: 403 });
    }
  }

  const org = await getOrgSettings();
  const current =
    org.dashboardSections && typeof org.dashboardSections === "object"
      ? (org.dashboardSections as Record<string, boolean>)
      : {};
  const next = { ...current, [key]: enabled };

  await prisma.orgSettings.update({
    where: { id: "singleton" },
    data: { dashboardSections: next },
  });

  return NextResponse.json({ ok: true });
}
