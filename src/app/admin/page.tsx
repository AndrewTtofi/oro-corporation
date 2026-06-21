import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CompletenessChip } from "@/components/admin/CompletenessChip";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { ProspectStatus } from "@prisma/client";
import type { Completeness } from "@/lib/services/prospect-intel";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const ic = (d: React.ReactNode) => (
  <svg className="ic ic-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS = {
  clock: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: ic(<path d="M5 13l4 4L19 7" />),
  docs: ic(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>),
  scale: ic(<><path d="M12 3v18M7 7h10" /><path d="M7 7l-3 6a3 3 0 0 0 6 0z M17 7l3 6a3 3 0 0 1-6 0z" /></>),
};

function statusClass(s: string) {
  return s === "approved" ? "badge-approved" : s === "needs_info" ? "badge-info" : s === "rejected" ? "badge-danger" : "badge-pending";
}
function prettyStatus(s: string) {
  return s === "pending" ? "Pending" : s === "needs_info" ? "Needs info" : s === "approved" ? "Approved" : "Rejected";
}
function prettyAction(a: string) {
  const m: Record<string, string> = {
    "submission.submitted": "Application submitted", "submission.created": "Application created",
    "submission.approved": "Approved", "submission.rejected": "Rejected",
    "submission.info_requested": "More info requested", "submission.status_changed": "Status changed",
    "document.uploaded": "Document uploaded", "note.added": "Note added", "client.created": "Client created",
  };
  return m[a] ?? a;
}

export default async function AdminDashboardPage() {
  await requireRole("staff");

  const [total, pending, approved, recent, activity] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: ProspectStatus.pending } }),
    prisma.prospect.count({ where: { status: ProspectStatus.approved } }),
    prisma.prospect.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
  ]);
  const conversion = total ? Math.round((approved / total) * 100) : 0;

  const kpis = [
    { label: "Awaiting review", value: pending, icon: ICONS.clock },
    { label: "Approved", value: approved, icon: ICONS.check },
    { label: "Total submissions", value: total, icon: ICONS.docs },
    { label: "Conversion", value: `${conversion}%`, icon: ICONS.scale },
  ];

  return (
    <AdminShell active="dashboard">
      <div className="mb-8">
        <div className="eyebrow mb-2">Firm overview</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Dashboard</h2>
      </div>

      <div className="grid grid-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi-top"><span className="eyebrow">{k.label}</span><span className="kpi-tile">{k.icon}</span></div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="twocol">
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Recent submissions</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{total} total</span></div>
          <table className="tbl">
            <thead><tr><th>Ref</th><th>Applicant</th><th>Brief</th><th>Status</th></tr></thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={4}><div className="empty"><h3>No submissions yet</h3><p>Applications appear here as they arrive.</p></div></td></tr>
              ) : recent.map((p) => {
                const eff = (p.completenessOverride ?? p.completeness) as Completeness | null;
                return (
                  <tr key={p.id} className="crm-row" data-href={`/admin/submissions/${p.referenceNumber}`} style={{ cursor: "pointer" }}>
                    <td className="mono">{p.referenceNumber}</td>
                    <td><div style={{ fontWeight: 500 }}>{p.user.fullName}</div><div className="sub">{p.user.email}</div></td>
                    <td>{eff ? <CompletenessChip value={eff} /> : <span className="muted">—</span>}</td>
                    <td><span className={`badge ${statusClass(p.status)}`}>{prettyStatus(p.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="tbl-foot"><span>Showing {recent.length} of {total}</span><Link href="/admin/submissions" className="link-gold">View all →</Link></div>
        </div>

        <div className="card">
          <h3 className="card-title">Recent activity</h3>
          <div className="timeline">
            {activity.length === 0 ? <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>No activity yet.</p> : activity.map((a) => (
              <div key={a.id} className="tl-item done" style={{ paddingBottom: "var(--space-4)" }}>
                <div className="node" />
                <div className="tl-title" style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{prettyAction(a.action)}</div>
                <div className="tl-meta">{a.actor?.fullName ?? "System"} · {a.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('tr.crm-row').forEach(function(r){r.addEventListener('click',function(){location.href=r.getAttribute('data-href')})})" }} />
    </AdminShell>
  );
}
