import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast, type PlanTier } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { prospectToSub, kycResult, ownershipFor, ownStats, aiScreen, complianceItems } from "@/lib/services/compliance-intel";
import { amlResult } from "@/lib/services/aml";

export const metadata = { title: "Compliance hub" };
export const dynamic = "force-dynamic";

type Card = { id: string; href: string; icon: string; title: string; desc: string; tier: PlanTier };
const CARDS: Card[] = [
  { id: "kyc", href: "/admin/compliance/kyc", icon: "passport", title: "KYC / ID verification", desc: "Document + biometric liveness and face-match.", tier: "scale" },
  { id: "aml", href: "/admin/compliance/aml", icon: "shield", title: "AML screening", desc: "Sanctions, PEP and adverse-media checks.", tier: "scale" },
  { id: "kyb", href: "/admin/compliance/kyb", icon: "building", title: "KYB verification", desc: "Company registry lookups and corporate records.", tier: "scale" },
  { id: "ai", href: "/admin/compliance/ai-screening", icon: "sparkles", title: "AI screening", desc: "Collapse raw hits into true matches.", tier: "scale" },
  { id: "own", href: "/admin/compliance/ownership", icon: "sitemap", title: "Ownership map", desc: "Visualise UBO structures and effective ownership.", tier: "scale" },
  { id: "risk", href: "/admin/compliance/risk", icon: "scale", title: "Client risk", desc: "0–100 risk scoring across the portfolio.", tier: "scale" },
  { id: "rep", href: "/admin/compliance/reporting", icon: "documents", title: "AML reporting", desc: "SAR/STR, periodic review and UBO confirmations.", tier: "scale" },
  { id: "cal", href: "/admin/compliance/calendar", icon: "calendar", title: "Compliance calendar", desc: "KYC expiry, UBO and annual-return deadlines.", tier: "professional" },
];

export default async function ComplianceHubPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();

  const prospects = await prisma.prospect.findMany({ include: { user: true, details: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const subs = prospects.map(prospectToSub);
  const ai = aiScreen(subs);
  const kycPending = subs.filter((s) => kycResult(s).status === "review").length;
  const ubos = subs.reduce((n, s) => { const o = ownershipFor(s); return n + (o ? ownStats(o).ubos : 0); }, 0);
  const overdue = complianceItems(subs.filter((_, i) => i < 6)).filter((x) => x.status === "overdue").length;

  // Cases needing attention: review-KYC, screening flags, or low completeness.
  const cases = subs.filter((s) => {
    const a = amlResult(s.ref);
    return kycResult(s).status === "review" || a.pep === "match" || a.adverse === "flag" || s.completeness === "low";
  }).slice(0, 8);

  return (
    <AdminShell active="compliance-hub">
      <div className="mb-8">
        <div className="eyebrow mb-2">Compliance</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Compliance hub</h2>
        <p className="mt-2 text-muted" style={{ fontSize: "0.9375rem", maxWidth: "60ch" }}>Your KYC, AML, KYB and risk tooling in one place — wired into the qualification gate.</p>
      </div>

      <div className="grid grid-4 mb-6">
        <Kpi label="Active onboardings" value={subs.length} icon="users" />
        <Kpi label="KYC pending" value={kycPending} icon="passport" />
        <Kpi label="AML flags" value={ai.matches.length} icon="shield" />
        <Kpi label="UBOs identified" value={ubos} icon="sitemap" />
      </div>

      <div className="eyebrow mb-3">Compliance suite</div>
      <div className="grid grid-3 mb-8">
        {CARDS.map((c) => {
          const unlocked = tierAtLeast(planTier, c.tier);
          const inner = (
            <>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div className="kpi-tile"><Icon name={c.icon} className="ic-18" /></div>
                {unlocked ? <Icon name="arrow" className="ic-16" /> : <span className="badge badge-neutral"><Icon name="lock" className="ic-16" /> {c.tier === "scale" ? "Scale" : "Professional"}</span>}
              </div>
              <div style={{ fontWeight: 600, marginTop: "var(--space-3)" }}>{c.title}</div>
              <p className="muted mt-2" style={{ fontSize: "var(--fs-xs)" }}>{c.desc}</p>
            </>
          );
          return unlocked
            ? <Link key={c.id} href={c.href} className="card" style={{ cursor: "pointer" }}>{inner}</Link>
            : <div key={c.id} className="card" style={{ opacity: 0.6 }}>{inner}</div>;
        })}
      </div>

      <div className="twocol">
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Cases needing attention</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{cases.length}</span></div>
          <table className="tbl">
            <thead><tr><th>Applicant</th><th>KYC</th><th>Screening</th></tr></thead>
            <tbody>
              {cases.length === 0 ? <tr><td colSpan={3}><div className="empty"><h3>All clear</h3><p>No cases need attention right now.</p></div></td></tr>
                : cases.map((s) => {
                  const a = amlResult(s.ref); const k = kycResult(s);
                  return (
                    <tr key={s.ref} className="crm-row" data-href={`/admin/submissions/${s.ref}`} style={{ cursor: "pointer" }}>
                      <td><div style={{ fontWeight: 500 }}>{s.name}</div><div className="sub mono">{s.ref}</div></td>
                      <td><span className={`badge ${k.status === "verified" ? "badge-approved" : "badge-pending"}`}>{k.status === "verified" ? "Verified" : "Review"}</span></td>
                      <td><span className={`badge ${a.pep === "match" || a.adverse === "flag" ? "badge-danger" : "badge-approved"}`}>{a.pep === "match" ? "PEP" : a.adverse === "flag" ? "Adverse" : "Clear"}</span></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="card-title">Compliance posture</h3>
          <dl className="dl">
            <dt>Applicants screened</dt><dd>{subs.length}</dd>
            <dt>Raw vendor hits</dt><dd className="mono">{ai.raw}</dd>
            <dt>True matches (AI)</dt><dd className="mono">{ai.matches.length}</dd>
            <dt>Structures mapped</dt><dd>{ai.structures}</dd>
            <dt>Overdue obligations</dt><dd className="mono">{overdue}</dd>
          </dl>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('tr.crm-row').forEach(function(r){r.addEventListener('click',function(){location.href=r.getAttribute('data-href')})})" }} />
    </AdminShell>
  );
}
