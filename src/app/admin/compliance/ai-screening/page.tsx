import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { prospectToSub, aiScreen } from "@/lib/services/compliance-intel";

export const metadata = { title: "AI screening" };
export const dynamic = "force-dynamic";

const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const sevBadge = (s: string) => (s === "high" ? "badge-danger" : s === "medium" ? "badge-pending" : "badge-new");

export default async function AiScreeningPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="ai-screening"><UpgradeGate required="scale" currentTier={planTier} title="AI screening" desc="An intelligence layer over raw AML: collapses thousands of vendor hits into a handful of true matches with reasons, sources and one-click escalation." /></AdminShell>;

  const prospects = await prisma.prospect.findMany({ include: { user: true, details: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const ai = aiScreen(prospects.map(prospectToSub));
  const reduction = ai.raw ? Math.round((1 - ai.matches.length / ai.raw) * 100) : 0;

  return (
    <AdminShell active="ai-screening">
      <div className="mb-6"><div className="eyebrow mb-2">Compliance</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>AI screening</h2></div>
      <div className="grid grid-4 mb-6">
        <Kpi label="Entities scanned" value={ai.entities} icon="sitemap" />
        <Kpi label="Raw vendor hits" value={ai.raw} icon="shield" />
        <Kpi label="True matches" value={ai.matches.length} icon="sparkles" />
        <Kpi label="Noise reduced" value={`${reduction}%`} icon="zap" />
      </div>
      <div className="note mb-6"><Icon name="sparkles" className="ic-18" /><div>AI cross-checks identifiers, dates and associates to keep only genuine matches and auto-dismiss namesakes — turning {ai.raw} raw hits into {ai.matches.length}. Live re-screen <strong>coming soon</strong>.</div></div>

      {ai.matches.length === 0 ? (
        <div className="empty"><div className="ec"><Icon name="check" /></div><h3>No true matches</h3><p>The AI layer cleared every raw hit across your portfolio.</p></div>
      ) : ai.matches.map((m, i) => (
        <div key={i} className="card mb-4 ai-match">
          <div className="row-between" style={{ alignItems: "flex-start" }}>
            <div className="cell-entity">
              {m.type === "person" ? <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials(m.name)}</div> : <div className="kpi-tile"><Icon name="building" className="ic-18" /></div>}
              <div><div className="row gap-2 wrap" style={{ alignItems: "center" }}><strong>{m.name}</strong><span className="tag">{m.jur}</span><span className="badge badge-neutral">{m.type === "person" ? "Individual" : "Entity"}</span></div><div className="sub">{m.ref}</div></div>
            </div>
            <div className="right center"><div className="ai-score mono">{m.score}</div><div className="eyebrow">match score</div></div>
          </div>
          <div className="row gap-2 wrap mt-4"><span className={`badge ${sevBadge(m.sev)}`}><span className="bdot" />{m.list}</span><span className={`badge ${sevBadge(m.sev)}`}><span className="bdot" />{m.sev} severity</span></div>
          <div className="note mt-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-color)" }}><Icon name="sparkles" className="ic-18" /><div><strong>Why AI kept this:</strong> {m.reason} <span className="muted">{m.dismissed} weaker hit{m.dismissed === 1 ? "" : "s"} auto-dismissed.</span></div></div>
          <div className="row gap-2 wrap mt-4"><span className="muted" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".05em", alignSelf: "center" }}>Sources</span>{m.sources.map((sc) => <span key={sc} className="chip"><Icon name="globe" className="ic-16" /> {sc}</span>)}</div>
          <div className="row gap-2 mt-4"><ComingSoon label="Escalate to EDD" /><ComingSoon label="False positive" /><Link href={`/admin/submissions/${m.ref}`} className="btn btn-ghost btn-sm right">Open case <Icon name="arrow" className="ic-16" /></Link></div>
        </div>
      ))}
    </AdminShell>
  );
}
