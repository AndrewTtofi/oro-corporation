import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { prospectToSub, ownershipFor, ownStats, type OwnerNode } from "@/lib/services/compliance-intel";

export const metadata = { title: "Ownership map" };
export const dynamic = "force-dynamic";

const screenBadge = (s: string) => s === "clear" ? <span className="badge badge-approved">Clear</span> : s === "pep" ? <span className="badge badge-danger">PEP</span> : s === "adverse" ? <span className="badge badge-danger">Adverse</span> : s === "review" ? <span className="badge badge-pending">Review</span> : <span className="badge badge-neutral">n/a</span>;
const kycBadge = (k: string) => k === "verified" ? <span className="badge badge-approved">KYC</span> : k === "pending" ? <span className="badge badge-pending">KYC pending</span> : <span className="badge badge-neutral">n/a</span>;

function OwnerTree({ nodes, parentFrac, depth }: { nodes: OwnerNode[]; parentFrac: number; depth: number }) {
  return (
    <div className="owner-children">
      {nodes.map((n, i) => {
        const eff = parentFrac * (n.pct / 100);
        const isUbo = n.type === "person" && eff >= 0.25;
        return (
          <div key={i} className="owner-node">
            <div className="owner-card">
              <div className={`onode-ic ${n.type}`}><Icon name={n.type === "person" ? "user" : "building"} className="ic-16" /></div>
              <div className="grow">
                <div className="row gap-2 wrap" style={{ alignItems: "center" }}>
                  <strong>{n.name}</strong><span style={{ fontSize: 14 }}>{n.flag}</span>
                  {isUbo && <span className="badge badge-new">UBO</span>}
                </div>
                <div className="muted" style={{ fontSize: "var(--fs-xs)" }}>{n.role} · {n.pct}% direct{depth > 1 ? ` · ${Math.round(eff * 100)}% effective` : ""}</div>
              </div>
              <div className="row gap-2">{kycBadge(n.kyc)}{screenBadge(n.screen)}</div>
            </div>
            {n.children && <OwnerTree nodes={n.children} parentFrac={eff} depth={depth + 1} />}
          </div>
        );
      })}
    </div>
  );
}

export default async function OwnershipPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="ownership-map"><UpgradeGate required="scale" currentTier={planTier} title="Ownership map" desc="Visualise multi-layer corporate structures with effective-ownership %, UBO flags at the 25% threshold and screening status at every node." /></AdminShell>;

  const sp = await searchParams;
  const prospects = await prisma.prospect.findMany({ include: { user: true, details: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const subs = prospects.map(prospectToSub).filter((s) => s.company !== "—");
  const entities = subs.map((s) => ({ s, o: ownershipFor(s)! })).filter((e) => e.o);
  const sel = entities.find((e) => e.s.ref === sp.ref) ?? entities[0];

  if (!sel) return <AdminShell active="ownership-map"><div className="empty"><div className="ec"><Icon name="sitemap" /></div><h3>No corporate structures</h3><p>Ownership maps appear for corporate applicants.</p></div></AdminShell>;
  const stats = ownStats(sel.o);

  return (
    <AdminShell active="ownership-map">
      <div className="mb-6"><div className="eyebrow mb-2">Compliance</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Ownership map</h2></div>

      {entities.length > 1 && (
        <div className="chips mb-5">
          {entities.map((e) => <Link key={e.s.ref} href={`/admin/compliance/ownership?ref=${e.s.ref}`} className={`chip${e.s.ref === sel.s.ref ? " active" : ""}`}>{e.o.flag} {e.o.entity}</Link>)}
        </div>
      )}

      <div className="grid grid-3 mb-6">
        <Kpi label="Entities mapped" value={stats.entities} icon="building" />
        <Kpi label="UBOs identified" value={stats.ubos} icon="users" />
        <Kpi label="Screening flags" value={stats.flags} icon="shield" />
      </div>
      <div className="note mb-6"><Icon name="sitemap" className="ic-18" /><div>We build the visualisation; corporate data integrates a KYB aggregator. Effective ownership is multiplied down the tree; ≥25% individuals are flagged as UBOs. Live structure re-screen <strong>coming soon</strong>.</div></div>

      <div className="card">
        <div className="row-between mb-4">
          <div className="row gap-3" style={{ alignItems: "center" }}>
            <div className="onode-ic entity"><Icon name="building" className="ic-18" /></div>
            <div><div style={{ fontWeight: 600 }}>{sel.o.entity} <span style={{ fontSize: 16 }}>{sel.o.flag}</span></div><div className="muted mono" style={{ fontSize: "var(--fs-xs)" }}>{sel.o.regNo} · {sel.o.type} · {sel.s.ref}</div></div>
          </div>
          <ComingSoon label="Screen entire structure" />
        </div>
        <OwnerTree nodes={sel.o.tree} parentFrac={1} depth={1} />
      </div>
    </AdminShell>
  );
}
