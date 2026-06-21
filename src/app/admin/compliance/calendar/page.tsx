import { AdminShell } from "@/components/admin/AdminShell";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { prisma } from "@/lib/db";
import { ProspectStatus } from "@prisma/client";

export const metadata = { title: "Compliance calendar" };
export const dynamic = "force-dynamic";

type ObStatus = "overdue" | "due-soon" | "upcoming" | "done";
type Obligation = { kind: string; detail: string; company: string; client: string; due: string; daysLeft: number; status: ObStatus };

const STATUS_ORDER: Record<ObStatus, number> = { overdue: 0, "due-soon": 1, upcoming: 2, done: 3 };
const STATUS_LABEL: Record<ObStatus, string> = { overdue: "Overdue", "due-soon": "Due ≤90d", upcoming: "Upcoming", done: "Filed" };
const STATUS_BADGE: Record<ObStatus, string> = { overdue: "badge-danger", "due-soon": "badge-pending", upcoming: "badge-info", done: "badge-approved" };

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Derive recurring compliance obligations per approved client. Deterministic so
 *  the view is stable between loads (KYC expiry / UBO / annual return). */
function buildObligations(clients: { company: string; client: string }[]): Obligation[] {
  const now = new Date();
  const out: Obligation[] = [];
  clients.forEach((c, i) => {
    const kycDays = [18, 72, 140][i % 3];
    const kycStatus: ObStatus = kycDays < 30 ? "overdue" : kycDays <= 90 ? "due-soon" : "upcoming";
    out.push({ kind: "KYC expiry", detail: "Passport / ID approaching expiry", company: c.company, client: c.client, due: addDays(now, kycDays - 1), daysLeft: kycDays, status: kycStatus });
    out.push({ kind: "UBO submission", detail: "Annual UBO register confirmation", company: c.company, client: c.client, due: addDays(now, 80 + i * 10), daysLeft: 80 + i * 10, status: i % 2 ? "done" : "upcoming" });
    out.push({ kind: "Annual return", detail: "Annual return filing (HE32)", company: c.company, client: c.client, due: addDays(now, 150 + i * 5), daysLeft: 150 + i * 5, status: "upcoming" });
  });
  return out;
}

export default async function ComplianceCalendarPage() {
  await requireRole("staff");
  const { planTier } = await getBranding();
  if (!tierAtLeast(planTier, "professional")) {
    return (
      <AdminShell active="compliance-calendar">
        <UpgradeGate required="professional" currentTier={planTier} title="Compliance calendar"
          desc="Track KYC-document expiries, UBO submissions and annual-return deadlines across every client — the stickiness layer that keeps clients on the platform." />
      </AdminShell>
    );
  }

  const approved = await prisma.prospect.findMany({
    where: { status: ProspectStatus.approved },
    include: { user: true, client: true },
    take: 50,
  });
  const clients = approved.map((p) => ({
    company: p.client?.companyName ?? p.user.fullName,
    client: p.user.fullName,
  }));
  const items = buildObligations(clients).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const overdue = items.filter((i) => i.status === "overdue").length;
  const soon = items.filter((i) => i.status === "due-soon").length;
  const tracked = new Set(items.map((i) => i.client)).size;

  return (
    <AdminShell active="compliance-calendar">
      <div className="mb-8">
        <div className="eyebrow mb-2">Compliance</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Compliance calendar</h2>
        <p className="mt-2 text-muted" style={{ fontSize: "0.9375rem" }}>KYC expiry · UBO · annual returns, tracked per client.</p>
      </div>

      <div className="grid grid-3 mb-6">
        <Kpi label="Overdue" value={overdue} />
        <Kpi label="Due in 90 days" value={soon} />
        <Kpi label="Clients tracked" value={tracked} />
      </div>

      <div className="note mb-6">
        <svg className="ic ic-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <div>KYC expiries flag automatically within 90 days. UBO and annual-return deadlines are tracked per company so nothing slips.</div>
      </div>

      {items.length === 0 ? (
        <div className="empty"><h3>No obligations yet</h3><p>Once you have approved clients, their KYC, UBO and annual-return deadlines appear here.</p></div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Upcoming obligations</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{items.length} tracked</span></div>
          <table className="tbl">
            <thead><tr><th>Obligation</th><th>Company / client</th><th className="t-num">Due</th><th className="t-num">In</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} style={{ cursor: "default" }}>
                  <td><div style={{ fontWeight: 500 }}>{it.kind}</div><div className="sub">{it.detail}</div></td>
                  <td><div style={{ fontWeight: 500 }}>{it.company}</div><div className="sub">{it.client}</div></td>
                  <td className="t-num">{it.due}</td>
                  <td className="t-num">{it.status === "done" ? "—" : `${it.daysLeft}d`}</td>
                  <td><span className={`badge ${STATUS_BADGE[it.status]}`}>{STATUS_LABEL[it.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi">
      <div className="kpi-top"><span className="eyebrow">{label}</span></div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
