import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { prospectToSub, riskScore, jurById } from "@/lib/services/compliance-intel";

export const metadata = { title: "Client risk" };
export const dynamic = "force-dynamic";

const svcLabel = (s: string) => s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const bandBadge = (b: string) => (b === "high" ? "badge-danger" : b === "medium" ? "badge-pending" : "badge-approved");

export default async function ClientRiskPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="client-risk"><UpgradeGate required="scale" currentTier={planTier} title="Client risk" desc="A 0–100 risk score per client from jurisdiction, structure, screening and documentation signals, with manual override and audit trail." /></AdminShell>;

  const prospects = await prisma.prospect.findMany({ include: { user: true, details: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const rows = prospects.map(prospectToSub).map(riskScore).sort((a, b) => b.score - a.score);
  const high = rows.filter((r) => r.band === "high").length;
  const med = rows.filter((r) => r.band === "medium").length;
  const low = rows.filter((r) => r.band === "low").length;
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length) : 0;

  return (
    <AdminShell active="client-risk">
      <div className="mb-6"><div className="eyebrow mb-2">Compliance</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Client risk</h2></div>
      <div className="grid grid-4 mb-6">
        <Kpi label="High-risk" value={high} icon="shield" />
        <Kpi label="Medium-risk" value={med} icon="scale" />
        <Kpi label="Low-risk" value={low} icon="check" />
        <Kpi label="Avg. score" value={avg} icon="dashboard" />
      </div>
      <div className="note mb-6"><Icon name="scale" className="ic-18" /><div>Score blends jurisdiction risk, cross-border nationality, ownership complexity, screening exposure and documentation gaps. Manual override + audit trail <strong>coming soon</strong>.</div></div>

      <div className="tbl-wrap">
        <div className="tbl-toolbar"><strong>Risk-rated clients</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{rows.length}</span></div>
        <table className="tbl">
          <thead><tr><th>Applicant</th><th>Service</th><th>Jurisdiction</th><th className="t-num">Score</th><th>Band</th><th>Top driver</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const sub = prospects.find((p) => p.referenceNumber === r.ref);
              const jId = sub ? prospectToSub({ ...sub }).jurisdictionId : "cy";
              return (
                <tr key={r.ref} className="crm-row" data-href={`/admin/submissions/${r.ref}`} style={{ cursor: "pointer" }}>
                  <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="sub mono">{r.ref}</div></td>
                  <td>{svcLabel(prospectToSub({ ...sub! }).serviceId)}</td>
                  <td>{jurById(jId).flag} {jurById(jId).name}</td>
                  <td className="t-num" style={{ fontWeight: 700 }}>{r.score}</td>
                  <td><span className={`badge ${bandBadge(r.band)}`}>{r.band}</span></td>
                  <td className="muted" style={{ fontSize: "var(--fs-xs)" }}>{r.top.label}</td>
                  <td style={{ textAlign: "right" }}><ComingSoon label="Override" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('tr.crm-row').forEach(function(r){r.addEventListener('click',function(){location.href=r.getAttribute('data-href')})})" }} />
    </AdminShell>
  );
}
