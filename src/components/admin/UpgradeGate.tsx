import Link from "next/link";
import { TIER_LABELS, type PlanTier } from "@/lib/services/branding";

const LockIcon = (
  <svg className="ic ic-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/** Shown in place of a feature page when the current plan tier is below the
 *  tier that unlocks it. Links to the branding/plan settings to change tier. */
export function UpgradeGate({ required, currentTier, title, desc }: { required: PlanTier; currentTier: string; title: string; desc: string }) {
  return (
    <div className="card" style={{ maxWidth: 560, margin: "var(--space-8) 0", textAlign: "center", padding: "var(--space-12)" }}>
      <div className="kpi-tile" style={{ width: 56, height: 56, margin: "0 auto var(--space-4)" }}>{LockIcon}</div>
      <h3 style={{ fontWeight: 600, fontSize: "var(--fs-h3)" }}>{title}</h3>
      <p className="muted mt-2" style={{ fontSize: "var(--fs-sm)" }}>{desc}</p>
      <div className="note mt-6" style={{ textAlign: "left" }}>
        <svg className="ic ic-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /></svg>
        <div>
          Included on the <strong>{TIER_LABELS[required]}</strong> plan. You are currently on{" "}
          <strong>{TIER_LABELS[(["starter", "professional", "scale"].includes(currentTier) ? currentTier : "professional") as PlanTier]}</strong>.
        </div>
      </div>
      <Link href="/admin/settings/branding" className="btn btn-primary mt-6">Change plan in settings</Link>
    </div>
  );
}
