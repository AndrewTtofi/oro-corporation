import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CompletenessChip } from "@/components/admin/CompletenessChip";
import { Icon } from "@/components/Icon";
import { prisma } from "@/lib/db";
import { ProspectStatus } from "@prisma/client";
import type { Completeness } from "@/lib/services/prospect-intel";

export const metadata = { title: "Submissions" };

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = (sp.status ?? "all") as "all" | "pending" | "needs_info" | "approved" | "rejected";
  const q = (sp.q ?? "").trim();

  const rows = await prisma.prospect.findMany({
    where: {
      ...(statusFilter !== "all" ? { status: statusFilter as ProspectStatus } : {}),
      ...(q
        ? {
            OR: [
              { referenceNumber: { contains: q, mode: "insensitive" } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: true,
      details: { where: { fieldName: { in: ["residenceCountry", "nationality"] } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminShell active="submissions" search={{ placeholder: "Search reference, name, email…" }}>
      <div className="mb-6">
        <div className="eyebrow mb-2">Intake</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Submissions queue</h2>
        <p className="muted mt-2" style={{ maxWidth: "60ch", fontSize: "0.9375rem", lineHeight: 1.6 }}>
          Applications submitted by prospective clients via the onboarding wizard.
          Review the file, exchange messages, run compliance, and convert once
          approved.
        </p>
      </div>

      {/* ── Filter chips ──────────────────────────────────────────── */}
      <div className="chips mb-6">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "needs_info", label: "Needs Info" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
        ].map((f) => {
          const isActive = statusFilter === f.key;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/admin/submissions" : `/admin/submissions?status=${f.key}`}
              className={`chip ${isActive ? "active" : ""}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="tbl-wrap">
        <div className="tbl-toolbar">
          <strong>Submissions</strong>
          <span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{rows.length}</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Applicant</th>
              <th>Services</th>
              <th>Country</th>
              <th>Brief</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <div className="ec"><Icon name="search" /></div>
                    <h3>No submissions match.</h3>
                    <p>Try a different filter, or wait for the next application to arrive.</p>
                  </div>
                </td>
              </tr>
            ) : rows.map((p) => {
              const country = p.details.find((d) => d.fieldName === "residenceCountry")?.fieldValue
                            ?? p.details.find((d) => d.fieldName === "nationality")?.fieldValue
                            ?? "—";
              const services = Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : [];
              return (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/admin/submissions/${p.referenceNumber}`}
                      className="mono"
                      style={{ fontSize: "var(--fs-xs)" }}
                    >
                      {p.referenceNumber}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/submissions/${p.referenceNumber}`} style={{ display: "block" }}>
                      <div style={{ fontWeight: 500 }}>{p.user.fullName}</div>
                      <div className="sub">{p.user.email}</div>
                    </Link>
                  </td>
                  <td>
                    <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                      {services.length === 0 && <span className="muted">—</span>}
                      {services.map((s) => (
                        <span key={s} className="badge badge-neutral">{pretty(s)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="muted">{country}</td>
                  <td>
                    {(() => {
                      const eff = (p.completenessOverride ?? p.completeness) as Completeness | null;
                      return eff ? <CompletenessChip value={eff} /> : <span className="muted">—</span>;
                    })()}
                  </td>
                  <td className="mono">
                    {p.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td>
                    <span className={`badge ${statusClass(p.status)}`}>{prettyStatus(p.status)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function pretty(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function prettyStatus(s: ProspectStatus) {
  return s === "pending" ? "Pending Review"
       : s === "needs_info" ? "Needs Info"
       : s === "approved" ? "Approved"
       : "Rejected";
}
function statusClass(s: ProspectStatus) {
  return s === "approved" ? "badge-approved"
       : s === "needs_info" ? "badge-info"
       : s === "rejected" ? "badge-danger"
       : "badge-pending";
}
