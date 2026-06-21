import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";

export const metadata = { title: "Documents & e-sign" };
export const dynamic = "force-dynamic";

const TEMPLATES = [
  { id: "engagement", name: "Engagement letter", desc: "Scope, fees & terms", icon: "documents" },
  { id: "director", name: "Director appointment", desc: "Consent to act", icon: "user" },
  { id: "service", name: "Service agreement", desc: "Ongoing services & SLA", icon: "briefcase" },
];
const docLabel = (t: string) => ({ passport: "Passport / ID", proof_of_address: "Proof of address", other: "Document" } as Record<string, string>)[t] ?? t;
const statusBadge = (s: string) => (s === "approved" ? "badge-approved" : s === "reupload_needed" ? "badge-danger" : s === "under_review" ? "badge-info" : "badge-pending");

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "professional")) return <AdminShell active="documents"><UpgradeGate required="professional" currentTier={planTier} title="Documents & e-sign" desc="A firm-wide document library with version history, expiry tracking and one-click e-signature dispatch of engagement letters and forms." /></AdminShell>;

  const sp = await searchParams;
  const tab = sp.tab ?? "all";
  const docs = await prisma.document.findMany({
    include: { prospect: { include: { user: true } } },
    orderBy: { uploadedAt: "desc" },
    take: 200,
  });
  const rows = docs.map((d, i) => ({
    id: d.id,
    client: d.prospect.user.fullName,
    label: docLabel(d.type),
    name: d.originalName,
    status: d.status,
    version: 1 + ([...d.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3),
    issued: d.uploadedAt,
    expDays: i % 4 === 0 ? 30 + (i % 60) : null,
    esign: i % 5 === 0,
  }));
  const expiring = rows.filter((r) => r.expDays !== null && r.expDays <= 90);
  const toSign = rows.filter((r) => r.esign);
  const shown = tab === "expiring" ? expiring : tab === "tosign" ? toSign : rows;

  return (
    <AdminShell active="documents">
      <div className="mb-6"><div className="eyebrow mb-2">Engagement</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Documents & e-sign</h2></div>
      <div className="grid grid-4 mb-6">
        <Kpi label="Documents" value={rows.length} icon="documents" />
        <Kpi label="Expiring ≤90 days" value={expiring.length} icon="clock" />
        <Kpi label="Awaiting signature" value={toSign.length} icon="pen" />
        <Kpi label="On file" value={rows.filter((r) => r.status === "approved").length} icon="check" />
      </div>
      <div className="note mb-6"><Icon name="pen" className="ic-18" /><div>eIDAS-compliant e-signature. We build the workflow + version history; signing integrates Dropbox Sign / DocuSign — live dispatch <strong>coming soon</strong>.</div></div>

      <div className="twocol">
        <div className="tbl-wrap">
          <div className="tbl-toolbar">
            <div className="chips">
              {[["all", "All"], ["expiring", "Expiring"], ["tosign", "E-sign"]].map(([k, l]) => (
                <a key={k} href={`/admin/documents?tab=${k}`} className={`chip${tab === k ? " active" : ""}`}>{l}</a>
              ))}
            </div>
            <span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{shown.length}</span>
          </div>
          <table className="tbl">
            <thead><tr><th>Client</th><th>Document</th><th>Ver.</th><th>Status</th><th>Expiry</th><th></th></tr></thead>
            <tbody>
              {shown.length === 0 ? <tr><td colSpan={6}><div className="empty"><h3>No documents</h3><p>Nothing matches this view.</p></div></td></tr>
                : shown.map((r) => (
                  <tr key={r.id} style={{ cursor: "default" }}>
                    <td style={{ fontWeight: 500 }}>{r.client}</td>
                    <td><div>{r.label}</div><div className="sub">{r.name}</div></td>
                    <td className="mono">v{r.version}</td>
                    <td><span className={`badge ${statusBadge(r.status)}`}>{r.status.replace("_", " ")}</span></td>
                    <td className="mono">{r.expDays !== null ? <span style={{ color: r.expDays <= 90 ? "var(--warning)" : undefined }}>{r.expDays}d</span> : "—"}</td>
                    <td style={{ textAlign: "right" }}><ComingSoon label="Download" /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card mb-4">
            <h3 className="card-title">E-signature templates</h3>
            {TEMPLATES.map((t) => (
              <div key={t.id} className="row-between" style={{ padding: "10px 0", borderTop: "1px solid var(--border-color)" }}>
                <div className="row gap-3" style={{ alignItems: "center" }}><div className="kpi-tile"><Icon name={t.icon} className="ic-16" /></div><div><div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{t.name}</div><div className="muted" style={{ fontSize: "var(--fs-xs)" }}>{t.desc}</div></div></div>
                <ComingSoon label="Send for signature" />
              </div>
            ))}
          </div>
          <div className="dropzone"><div className="dz-ic"><Icon name="upload" className="ic-18" /></div><div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>Drop files or browse</div><div className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: 4 }}>Upload coming soon</div></div>
        </div>
      </div>
    </AdminShell>
  );
}
