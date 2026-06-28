import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, TIER_LABELS, type PlanTier } from "@/lib/services/branding";
import { getDashboardSectionStates } from "@/lib/services/dashboard-sections";
import { SectionsTable } from "./SectionsTable";

export const metadata = { title: "Client dashboard" };
export const dynamic = "force-dynamic";

export default async function ClientDashboardSettingsPage() {
  await requireRole("staff");
  const [{ planTier }, states] = await Promise.all([getBranding(), getDashboardSectionStates()]);
  const sections = states.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    minTierLabel: TIER_LABELS[s.minTier],
    enabled: s.enabled,
    locked: s.locked,
  }));

  return (
    <AdminShell active="client-dashboard">
      <div className="mb-6">
        <div className="eyebrow mb-2">Client experience</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Client dashboard</h2>
        <p className="muted mt-1" style={{ fontSize: "var(--fs-sm)" }}>
          Choose which cards appear on every client&apos;s dashboard. Your firm is on the{" "}
          <strong>{TIER_LABELS[planTier as PlanTier]}</strong> plan — sections above your plan are locked.
        </p>
      </div>
      <SectionsTable initial={sections} />
    </AdminShell>
  );
}
