import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { catLabel } from "@/lib/data/marketplace";

export const metadata = { title: "My applications" };
export const dynamic = "force-dynamic";

const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
function statusBadge(s: string) {
  return s === "approved" ? "badge-approved" : s === "review" ? "badge-under-review" : "badge-pending";
}

export default async function ClientApplicationsPage() {
  const user = await requireUser();
  const [prospect, client, apps] = await Promise.all([
    prisma.prospect.findUnique({ where: { userId: user.id } }),
    prisma.client.findUnique({ where: { userId: user.id } }),
    prisma.application.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!prospect) redirect("/onboarding");
  const approved = prospect.status === "approved" || !!client;

  return (
    <ClientShell active="applications" approved={approved}>
      <div className="mb-6">
        <div className="eyebrow mb-2">Partner network requests</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>My applications</h2>
      </div>

      {apps.length === 0 ? (
        <div className="empty">
          <h3>No applications yet</h3>
          <p>Browse the partner network and apply — your KYC profile is reused automatically.</p>
          <Link href="/app/marketplace" className="btn btn-primary mt-2">Browse partner network</Link>
        </div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Partner applications</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{apps.length}</span></div>
          <table className="tbl">
            <thead><tr><th>Partner</th><th>Category</th><th>Status</th><th>Submitted</th><th>Response</th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} style={{ cursor: "default" }}>
                  <td><div className="cell-entity"><div className="avatar avatar-sq" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(a.providerName)}</div><div><div style={{ fontWeight: 500 }}>{a.providerName}</div><div className="sub mono">{a.id.slice(0, 8)}</div></div></div></td>
                  <td>{catLabel(a.category)}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}><span className="bdot" />{a.status}</span></td>
                  <td className="mono">{a.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="muted">{a.responseBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note" style={{ margin: 16 }}><div>Your verified KYC profile is reused for every partner — fill it once, apply anywhere.</div></div>
        </div>
      )}
    </ClientShell>
  );
}
