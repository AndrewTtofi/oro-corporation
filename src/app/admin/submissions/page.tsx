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
      <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Submissions Queue</h1>
          <p className="text-meta text-admin-muted mt-1">Review and manage incoming client applications.</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "needs_info", label: "Needs Info" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
        ].map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/submissions" : `/admin/submissions?status=${f.key}`}
            className={`px-3 py-1.5 rounded-inner text-meta font-medium transition-colors ${
              statusFilter === f.key ? "" : "bg-admin-surface text-admin-fg"
            }`}
            style={
              statusFilter === f.key
                ? { background: "var(--dark)", color: "white", borderColor: "var(--dark)" }
                : { border: "1px solid var(--border)" }
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="bg-admin-surface border border-admin-border rounded-elem overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr style={{ background: "#FDFDFD" }}>
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
                  <td colSpan={6} className="p-12 text-center text-admin-muted text-meta">No submissions match this filter.</td>
                </tr>
              ) : rows.map((p) => {
                const country = p.details.find((d) => d.fieldName === "residenceCountry")?.fieldValue
                              ?? p.details.find((d) => d.fieldName === "nationality")?.fieldValue
                              ?? "—";
                const services = Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : [];
                return (
                  <tr key={p.id} className="border-t border-admin-border hover:bg-admin-bg cursor-pointer">
                    <Td>
                      <Link href={`/admin/submissions/${p.referenceNumber}`} className="font-mono text-meta text-admin-muted hover:text-accent">
                        {p.referenceNumber}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/admin/submissions/${p.referenceNumber}`} className="block">
                        <span className="font-semibold block">{p.user.fullName}</span>
                        <span className="text-[12px] text-admin-muted">{p.user.email}</span>
                      </Link>
                    </Td>
                    <Td>{services.map(pretty).join(", ") || "—"}</Td>
                    <Td>{country}</Td>
                    <Td>{p.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
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
  return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-admin-muted font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-4 text-meta align-middle">{children}</td>;
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
