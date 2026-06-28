import { getOrgSettings } from "@/lib/services/settings";
import { getBranding, tierAtLeast, type PlanTier } from "@/lib/services/branding";

/**
 * Catalog of the toggleable cards on the active-client dashboard
 * (src/app/app/dashboard/ClientDashboard.tsx). Staff enable/disable these
 * globally from /admin/client-dashboard; availability is gated by the firm's
 * plan tier (OrgSettings.planTier). This is the single source of truth — the
 * admin UI, the API guard and the dashboard renderer all read from here.
 */
export const DASHBOARD_SECTIONS = [
  { key: "kpis",             label: "Summary KPIs",        description: "Counters for active services, upcoming dates, open requests and recent messages.", minTier: "starter" },
  { key: "documentRequests", label: "Document requests",   description: "Outstanding documents your firm has requested from the client.",                  minTier: "starter" },
  { key: "keyDates",         label: "Upcoming key dates",  description: "Filing deadlines and reminders due in the next 30 days.",                          minTier: "starter" },
  { key: "consultation",     label: "Consultation",        description: "Card to book or manage an advisor consultation.",                                  minTier: "starter" },
  { key: "selectedServices", label: "Selected services",   description: "The services the client is engaged for.",                                          minTier: "starter" },
  { key: "recentActivity",   label: "Recent activity",     description: "A timeline of recent account events.",                                             minTier: "professional" },
] as const;

export type DashboardSectionKey = (typeof DASHBOARD_SECTIONS)[number]["key"];

export const DASHBOARD_SECTION_KEYS: DashboardSectionKey[] = DASHBOARD_SECTIONS.map((s) => s.key);

export function isDashboardSectionKey(k: string): k is DashboardSectionKey {
  return DASHBOARD_SECTION_KEYS.includes(k as DashboardSectionKey);
}

/** Read the stored { [key]: boolean } overrides off the OrgSettings singleton. */
function readOverrides(value: unknown): Partial<Record<DashboardSectionKey, boolean>> {
  if (!value || typeof value !== "object") return {};
  const out: Partial<Record<DashboardSectionKey, boolean>> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isDashboardSectionKey(k) && typeof v === "boolean") out[k] = v;
  }
  return out;
}

export type DashboardSectionState = {
  key: DashboardSectionKey;
  label: string;
  description: string;
  minTier: PlanTier;
  /** Staff toggle value (defaults to on). Independent of locking. */
  enabled: boolean;
  /** True when the firm's plan is below minTier — staff cannot turn it on. */
  locked: boolean;
};

/** Full per-section state for the admin toggle UI. */
export async function getDashboardSectionStates(): Promise<DashboardSectionState[]> {
  const [org, { planTier }] = await Promise.all([getOrgSettings(), getBranding()]);
  const overrides = readOverrides(org.dashboardSections);
  return DASHBOARD_SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    minTier: s.minTier as PlanTier,
    enabled: overrides[s.key] ?? true,
    locked: !tierAtLeast(planTier, s.minTier as PlanTier),
  }));
}

/** Map of section → visible, for the client dashboard renderer. A section is
 *  visible only when it is both enabled by staff and unlocked by the plan. */
export async function getVisibleDashboardSections(): Promise<Record<DashboardSectionKey, boolean>> {
  const states = await getDashboardSectionStates();
  const out = {} as Record<DashboardSectionKey, boolean>;
  for (const s of states) out[s.key] = s.enabled && !s.locked;
  return out;
}
