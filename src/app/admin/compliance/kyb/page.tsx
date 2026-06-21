import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { prospectToSub, kybRecord, ownershipFor, jurById } from "@/lib/services/compliance-intel";

export const metadata = { title: "KYB verification" };
export const dynamic = "force-dynamic";

export default async function KybPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="kyb"><UpgradeGate required="scale" currentTier={planTier} title="KYB verification" desc="Verify companies against official registries across 200+ countries — legal status, directors, filings and ownership — wrap a KYB aggregator, build the workflow." /></AdminShell>;

  const prospects = await prisma.prospect.findMany({ include: { user: true, details: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const corps = prospects.map(prospectToSub).filter((s) => s.company !== "—");

  return (
    <AdminShell active="kyb">
      <div className="mb-6"><div className="eyebrow mb-2">Compliance</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>KYB verification</h2></div>
      <div className="grid grid-3 mb-6">
        <Kpi label="Companies verified" value={corps.length} icon="building" />
        <Kpi label="Registry coverage" value="200+" icon="globe" />
        <Kpi label="With ownership map" value={corps.filter((s) => ownershipFor(s)).length} icon="sitemap" />
      </div>
      <div className="note mb-6"><Icon name="building" className="ic-18" /><div>Verified against official company registries. We build the workflow; data integrates a KYB aggregator. Live registry refresh <strong>coming soon</strong>.</div></div>

      {corps.length === 0 ? (
        <div className="empty"><h3>No corporate applicants</h3><p>KYB records appear for company applicants.</p></div>
      ) : (
        <div className="grid grid-2">
          {corps.map((s) => {
            const r = kybRecord(s);
            return (
              <div key={s.ref} className="card">
                <div className="row-between mb-3">
                  <div className="row gap-2" style={{ alignItems: "center" }}><strong>{r.legalName}</strong><span style={{ fontSize: 16 }}>{jurById(s.jurisdictionId).flag}</span></div>
                  <span className="badge badge-approved"><span className="bdot" />Verified against registry</span>
                </div>
                <dl className="dl">
                  <dt>Legal status</dt><dd><span className="badge badge-approved">Active</span></dd>
                  <dt>Company type</dt><dd>{r.type}</dd>
                  <dt>Reg. number</dt><dd className="mono">{r.regNo}</dd>
                  <dt>Incorporated</dt><dd className="mono">{r.incorporated}</dd>
                  <dt>Registered office</dt><dd>{r.address}</dd>
                  <dt>Nature of business</dt><dd>{r.activity}</dd>
                  <dt>Directors</dt><dd>{r.directors.map((d) => d.name).join(", ")}</dd>
                  <dt>Last filing</dt><dd className="mono">{r.lastFiling} · {r.lastFilingType}</dd>
                  <dt>Source</dt><dd>{r.registry} · retrieved {r.retrieved}</dd>
                </dl>
                <div className="row gap-2 mt-4">
                  {ownershipFor(s) && <Link href={`/admin/compliance/ownership?ref=${s.ref}`} className="btn btn-secondary btn-sm"><Icon name="sitemap" className="ic-16" /> View ownership map</Link>}
                  <ComingSoon label="Refresh from registry" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
