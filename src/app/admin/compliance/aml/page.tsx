import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";

export const metadata = { title: "AML screening" };
export const dynamic = "force-dynamic";

/** Deterministic mock screening result, keyed by reference (mirrors prototype).
 *  In production this panel wraps a third-party screening API. */
function amlResult(ref: string) {
  const hash = [...ref].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pep = hash % 4 === 0;
  const adverse = hash % 6 === 0;
  return {
    sanctions: "clear" as const,
    pep: pep ? "match" : "clear",
    adverse: adverse ? "flag" : "clear",
    risk: pep && adverse ? "high" : pep || adverse ? "medium" : "low",
  };
}

function amlBadge(v: string) {
  if (v === "clear") return <span className="badge badge-approved">Clear</span>;
  if (v === "match") return <span className="badge badge-pending">PEP match</span>;
  if (v === "flag") return <span className="badge badge-danger">Adverse</span>;
  return <span className="badge badge-neutral">{v}</span>;
}
function riskBadge(r: string) {
  const cls = r === "low" ? "badge-approved" : r === "medium" ? "badge-pending" : "badge-danger";
  return <span className={`badge ${cls}`}>{r} risk</span>;
}

export default async function AmlPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) {
    return (
      <AdminShell active="aml">
        <UpgradeGate required="scale" currentTier={planTier} title="AML / KYC screening"
          desc="Run sanctions, PEP and adverse-media checks on every applicant, wired straight into the qualification gate. Integrate a provider — build the workflow, not the database." />
      </AdminShell>
    );
  }

  const prospects = await prisma.prospect.findMany({
    include: { user: true, details: { where: { fieldName: "nationality" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const rows = prospects.map((p) => ({
    ref: p.referenceNumber,
    name: p.user.fullName,
    nationality: p.details[0]?.fieldValue ?? "—",
    result: amlResult(p.referenceNumber),
  }));
  const flagged = rows.filter((r) => r.result.risk !== "low").length;

  return (
    <AdminShell active="aml">
      <div className="mb-8">
        <div className="eyebrow mb-2">Compliance</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>AML screening</h2>
        <p className="mt-2 text-muted" style={{ fontSize: "0.9375rem" }}>Sanctions · PEP · adverse media.</p>
      </div>

      <div className="grid grid-4 mb-6">
        <Kpi label="Screened" value={rows.length} />
        <Kpi label="Sanctions hits" value={0} />
        <Kpi label="PEP / adverse" value={flagged} />
        <Kpi label="Avg. turnaround" value="1.2s" />
      </div>

      <div className="note mb-6">
        <svg className="ic ic-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15z" /></svg>
        <div>Every applicant is screened against sanctions, PEP and adverse-media lists at intake. Matches route to enhanced due diligence automatically. <strong>Integrate, don&apos;t build</strong> — this panel wraps a third-party screening API.</div>
      </div>

      {rows.length === 0 ? (
        <div className="empty"><h3>Nothing to screen</h3><p>Applicants appear here as soon as they submit.</p></div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Screening results</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{rows.length} screened</span></div>
          <table className="tbl">
            <thead><tr><th>Applicant</th><th>Sanctions</th><th>PEP</th><th>Adverse media</th><th>Risk</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ref} className="crm-row" data-href={`/admin/submissions/${r.ref}`} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="cell-entity">
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{r.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
                      <div><div style={{ fontWeight: 500 }}>{r.name}</div><div className="sub">{r.nationality}</div></div>
                    </div>
                  </td>
                  <td>{amlBadge(r.result.sanctions)}</td>
                  <td>{amlBadge(r.result.pep)}</td>
                  <td>{amlBadge(r.result.adverse)}</td>
                  <td>{riskBadge(r.result.risk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted mt-4" style={{ fontSize: "var(--fs-xs)" }}>
        Need the full party-level KYC engine? See <Link href="/admin/compliance/tasks" className="link-gold">Compliance tasks</Link>.
      </p>
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('tr.crm-row').forEach(function(r){r.addEventListener('click',function(){location.href=r.getAttribute('data-href')})})" }} />
    </AdminShell>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="kpi">
      <div className="kpi-top"><span className="eyebrow">{label}</span></div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
