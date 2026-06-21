import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { AML_TEMPLATES, AML_REPORT_LOG } from "@/lib/data/compliance";

export const metadata = { title: "AML reporting" };
export const dynamic = "force-dynamic";

const statusBadge = (s: string) => (s === "approved" ? "badge-approved" : "badge-pending");

export default async function AmlReportingPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="aml-reporting"><UpgradeGate required="scale" currentTier={planTier} title="AML reporting" desc="Generate SAR/STR filings, periodic AML reviews, KYC-refresh packs and UBO confirmations from your live case data, with an audit trail." /></AdminShell>;

  return (
    <AdminShell active="aml-reporting">
      <div className="mb-6"><div className="eyebrow mb-2">Compliance</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>AML reporting</h2></div>
      <div className="grid grid-3 mb-6">
        <Kpi label="Open cases" value={AML_REPORT_LOG.filter((r) => r.status !== "approved").length} icon="flag" />
        <Kpi label="Templates ready" value={AML_TEMPLATES.length} icon="documents" />
        <Kpi label="Reports generated" value={AML_REPORT_LOG.length} icon="check" />
      </div>

      <div className="eyebrow mb-3">Report templates</div>
      <div className="grid grid-2 mb-8">
        {AML_TEMPLATES.map((t) => (
          <div key={t.id} className="card">
            <div className="row gap-3 mb-2" style={{ alignItems: "center" }}>
              <div className="kpi-tile"><Icon name={t.icon} className="ic-18" /></div>
              <div><div style={{ fontWeight: 600 }}>{t.name}</div><div className="muted" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".05em" }}>{t.reg}</div></div>
            </div>
            <p className="muted mt-2" style={{ fontSize: "var(--fs-sm)" }}>{t.desc}</p>
            <div className="mt-3"><ComingSoon label="Generate report" /></div>
          </div>
        ))}
      </div>

      <div className="tbl-wrap">
        <div className="tbl-toolbar"><strong>Recent reports</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{AML_REPORT_LOG.length}</span></div>
        <table className="tbl">
          <thead><tr><th>Report</th><th>Subject</th><th>Filed by</th><th>When</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {AML_REPORT_LOG.map((r, i) => (
              <tr key={i} style={{ cursor: "default" }}>
                <td><div className="row gap-2" style={{ alignItems: "center" }}><Icon name={r.icon} className="ic-16" /><span style={{ fontWeight: 500 }}>{r.report}</span></div></td>
                <td className="muted">{r.subject}</td>
                <td>{r.by}</td>
                <td className="mono">{r.at}</td>
                <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                <td style={{ textAlign: "right" }}><ComingSoon label="Export" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
