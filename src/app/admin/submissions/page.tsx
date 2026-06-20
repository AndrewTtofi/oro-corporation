import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { prisma } from "@/lib/db";
import { ProspectStatus } from "@prisma/client";

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
      <div className="mb-12">
        <div className="eyebrow mb-2">Intake</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Submissions queue</h2>
        <p className="mt-2 max-w-[60ch] text-muted" style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
          Applications submitted by prospective clients via the onboarding wizard.
          Review the file, exchange messages, run compliance, and convert once
          approved.
        </p>
      </div>

      <hr className="hairline mb-8" />

      {/* ── Filter chips ──────────────────────────────────────────── */}
      <div className="flex gap-3 mb-10 flex-wrap">
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
              className={`px-4 py-2 font-mono text-[10px] tracking-[0.22em] uppercase transition-all duration-500 ${
                isActive ? "text-bone" : "text-muted hover:text-ink"
              }`}
              style={
                isActive
                  ? { background: "var(--ink)", border: "1px solid var(--ink)" }
                  : { background: "transparent", border: "1px solid var(--admin-border)" }
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <Th>Reference</Th>
                <Th>Applicant</Th>
                <Th>Services</Th>
                <Th>Country</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <p className="mb-2" style={{ fontSize: "1.125rem", fontWeight: 600 }}>No submissions match.</p>
                    <p className="text-[13px] text-muted">
                      Try a different filter, or wait for the next application to arrive.
                    </p>
                  </td>
                </tr>
              ) : rows.map((p) => {
                const country = p.details.find((d) => d.fieldName === "residenceCountry")?.fieldValue
                              ?? p.details.find((d) => d.fieldName === "nationality")?.fieldValue
                              ?? "—";
                const services = Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : [];
                return (
                  <tr key={p.id} className="group" style={{ borderTop: "1px solid var(--admin-border)" }}>
                    <Td>
                      <Link
                        href={`/admin/submissions/${p.referenceNumber}`}
                        className="font-mono figure text-[12px] tracking-[0.04em] text-accent-deep link-gold"
                      >
                        {p.referenceNumber}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/admin/submissions/${p.referenceNumber}`} className="block">
                        <span className="font-display text-[17px] tracking-[-0.005em] text-ink leading-tight block group-hover:text-accent-deep transition-colors duration-500">
                          {p.user.fullName}
                        </span>
                        <span className="block mt-0.5 font-mono text-[10px] tracking-[0.14em] uppercase text-muted">
                          {p.user.email}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5 flex-wrap">
                        {services.length === 0 && <span className="text-muted">—</span>}
                        {services.map((s) => (
                          <span
                            key={s}
                            className="font-mono text-[9.5px] tracking-[0.14em] uppercase px-2 py-1"
                            style={{ background: "var(--admin-bg)", color: "var(--admin-fg)", border: "1px solid var(--admin-border)" }}
                          >
                            {pretty(s)}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td className="font-mono figure text-[12px] uppercase tracking-[0.12em] text-muted">{country}</Td>
                    <Td className="font-mono figure text-[12px] text-muted">
                      {p.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </Td>
                    <Td>
                      <span className={`badge ${statusClass(p.status)}`}>{prettyStatus(p.status)}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-6 py-4 font-mono text-[9.5px] tracking-[0.24em] uppercase text-muted font-medium">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-6 py-5 align-middle ${className}`}>{children}</td>;
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
