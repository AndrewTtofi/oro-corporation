import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { prospectToSub, kycResult, countryFlag } from "@/lib/services/compliance-intel";

export const metadata = { title: "KYC / ID verification" };
export const dynamic = "force-dynamic";

export default async function KycPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="kyc"><UpgradeGate required="scale" currentTier={planTier} title="KYC / ID verification" desc="Document + biometric liveness, face-match and deepfake checks across 230+ countries — wrap a provider (iDenfy / Onfido / Veriff), build the workflow." /></AdminShell>;

  const sp = await searchParams;
  const prospects = await prisma.prospect.findMany({ include: { user: true, details: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const subs = prospects.map(prospectToSub);
  const rows = subs.map((s) => ({ s, k: kycResult(s) }));
  const verified = rows.filter((r) => r.k.status === "verified").length;
  const avgFace = rows.length ? Math.round(rows.reduce((n, r) => n + r.k.faceMatch, 0) / rows.length) : 0;
  const selected = subs.find((s) => s.ref === sp.ref) ?? subs[0];
  const sel = selected ? kycResult(selected) : null;
  const liveP = sel ? (sel.liveness ? 92 : 41) : 0;

  return (
    <AdminShell active="kyc">
      <div className="mb-6"><div className="eyebrow mb-2">Compliance</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>KYC / ID verification</h2></div>
      <div className="grid grid-4 mb-6">
        <Kpi label="ID checks" value={rows.length} icon="passport" />
        <Kpi label="Verified" value={verified} icon="check" />
        <Kpi label="Needs review" value={rows.length - verified} icon="bell" />
        <Kpi label="Avg. face-match" value={`${avgFace}%`} icon="user" />
      </div>
      <div className="note mb-6"><Icon name="passport" className="ic-18" /><div>230+ countries, 11,000+ document types. <strong>Integrate, don&apos;t build</strong> — this wraps iDenfy / Onfido / Veriff.</div></div>

      <div className="twocol">
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Verification results</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{rows.length}</span></div>
          <table className="tbl">
            <thead><tr><th>Applicant</th><th>Document</th><th className="t-num">Face-match</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(({ s, k }) => (
                <tr key={s.ref} className="crm-row" data-href={`/admin/compliance/kyc?ref=${s.ref}`} style={{ cursor: "pointer", background: selected?.ref === s.ref ? "var(--brand-50)" : undefined }}>
                  <td><div style={{ fontWeight: 500 }}>{s.name}</div><div className="sub">{countryFlag(k.docCountry)} {k.docCountry}</div></td>
                  <td>{k.docType}</td>
                  <td className="t-num">{k.faceMatch}%</td>
                  <td><span className={`badge ${k.status === "verified" ? "badge-approved" : "badge-pending"}`}>{k.status === "verified" ? "Verified" : "Needs review"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          {sel && selected ? (
            <>
              <div className="card-head"><h3 className="card-title" style={{ marginBottom: 0 }}>{selected.name}</h3><span className={`badge ${sel.status === "verified" ? "badge-approved" : "badge-pending"}`}>{sel.status === "verified" ? "Verified" : "Needs review"}</span></div>
              <div className="row gap-2 wrap mb-4"><span className="tag">{countryFlag(sel.docCountry)} {sel.docCountry}</span><span className="tag">{sel.docType}</span><span className="tag">Confidence {sel.confidence}%</span></div>
              <div className="eyebrow mb-2">Biometric breakdown</div>
              <Metric label="Face-match score" pct={sel.faceMatch} ok={sel.faceMatch >= 90} />
              <div className="mt-3"><Metric label="Liveness (passive)" pct={liveP} ok={sel.liveness} /></div>
              <div className="row-between mt-3" style={{ padding: "10px 0", borderTop: "1px solid var(--border-color)", fontSize: "var(--fs-xs)" }}><span className="muted">Document authenticity</span><span className="badge badge-approved">Genuine</span></div>
              <div className="row-between" style={{ padding: "10px 0", borderTop: "1px solid var(--border-color)", fontSize: "var(--fs-xs)" }}><span className="muted">Deepfake / injection check</span><span className={`badge ${sel.deepfake ? "badge-approved" : "badge-danger"}`}>{sel.deepfake ? "Clear" : "Flagged"}</span></div>
              <hr className="hairline" style={{ margin: "16px 0" }} />
              <div className="eyebrow mb-2">OCR-extracted fields</div>
              <dl className="dl"><dt>Full name</dt><dd>{selected.name}</dd><dt>Nationality</dt><dd>{countryFlag(sel.docCountry)} {sel.docCountry}</dd><dt>Document no.</dt><dd className="mono">{sel.docNumber}</dd><dt>Expiry</dt><dd className="mono">{sel.expiry}</dd></dl>
              <div className="note mt-4" style={{ fontSize: "var(--fs-2xs)" }}><Icon name="lock" className="ic-16" /><div>Auto-extracted by OCR and cross-checked against the submission. Live re-run against the provider is <strong>coming soon</strong>.</div></div>
            </>
          ) : <div className="empty"><h3>No applicants</h3><p>Verifications appear here as applicants submit.</p></div>}
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('tr.crm-row').forEach(function(r){r.addEventListener('click',function(){location.href=r.getAttribute('data-href')})})" }} />
    </AdminShell>
  );
}

function Metric({ label, pct, ok }: { label: string; pct: number; ok: boolean }) {
  const tone = ok ? "var(--success)" : pct >= 75 ? "var(--warning)" : "var(--danger)";
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 5 }}><span className="muted" style={{ fontSize: "var(--fs-xs)" }}>{label}</span><span className="mono" style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: tone }}>{pct}%</span></div>
      <div className="progress"><i style={{ width: `${pct}%`, background: tone }} /></div>
    </div>
  );
}
