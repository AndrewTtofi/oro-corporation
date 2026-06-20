import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { prisma } from "@/lib/db";
import { ClientStatus, ProspectStatus } from "@prisma/client";
import { ConvertModal } from "./ConvertModal";
import { FilterSelect } from "./FilterSelect";

export const metadata = { title: "Clients" };

interface PageProps {
  searchParams: Promise<{ status?: string; service?: string; partner?: string; q?: string }>;
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = (sp.status ?? "all") as "all" | "active" | "on_hold" | "completed";
  const serviceFilter = sp.service ?? "all";
  const partnerFilter = sp.partner ?? "all";
  const q = (sp.q ?? "").trim();

  const rows = await prisma.client.findMany({
    where: {
      ...(statusFilter !== "all" ? { status: statusFilter as ClientStatus } : {}),
      ...(serviceFilter !== "all" ? { services: { some: { serviceType: serviceFilter } } } : {}),
      ...(partnerFilter !== "all" ? { services: { some: { assignedPartnerId: partnerFilter } } } : {}),
      ...(q
        ? {
            OR: [
              { companyName: { contains: q, mode: "insensitive" } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: true,
      primaryStaff: true,
      services: { include: { assignedPartner: true } },
      keyDates: { where: { status: { in: ["upcoming", "overdue"] } }, orderBy: { dueDate: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  const partners = await prisma.user.findMany({ where: { role: "partner" }, select: { id: true, fullName: true } });
  const approvedProspects = await prisma.prospect.findMany({
    where: { status: ProspectStatus.approved, client: null },
    include: { user: true, complianceFile: { select: { status: true } } },
    orderBy: { reviewedAt: "desc" },
  });

  return (
    <AdminShell active="clients" search={{ placeholder: "Search clients, companies…" }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="mb-12 flex justify-between items-end flex-wrap gap-6">
        <div>
          <div className="eyebrow mb-2">Engagements</div>
          <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Active clients</h2>
          <div className="mt-3 flex items-center gap-5 font-mono text-[10px] tracking-[0.22em] uppercase text-muted">
            <span>{rows.length} on roster</span>
            {approvedProspects.length > 0 && (
              <span className="text-accent-deep">· {approvedProspects.length} awaiting conversion</span>
            )}
          </div>
        </div>
        <ConvertModal candidates={approvedProspects.map((p) => ({
          prospectId: p.id,
          referenceNumber: p.referenceNumber,
          name: p.user.fullName,
          services: (Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : []),
          compliance: p.complianceFile?.status ?? "open",
        }))} />
      </div>

      <hr className="hairline mb-8" />

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex gap-4 mb-10 overflow-x-auto pb-1">
        <FilterSelect name="service" label="Service Type" current={serviceFilter} options={[
          { value: "all", label: "All Services" },
          { value: "company_formation", label: "Company Formation" },
          { value: "accounting", label: "Accounting" },
          { value: "tax_residency", label: "Tax Residency" },
          { value: "immigration", label: "Immigration" },
          { value: "banking", label: "Banking" },
          { value: "licensing", label: "Licensing" },
        ]} />
        <FilterSelect name="partner" label="Assigned Partner" current={partnerFilter} options={[
          { value: "all", label: "All Partners" },
          ...partners.map((p) => ({ value: p.id, label: p.fullName })),
        ]} />
        <FilterSelect name="status" label="Status" current={statusFilter} options={[
          { value: "all", label: "All Statuses" },
          { value: "active", label: "Active" },
          { value: "on_hold", label: "On Hold" },
          { value: "completed", label: "Completed" },
        ]} />
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                <Th>Client</Th>
                <Th>Services</Th>
                <Th>Partner</Th>
                <Th>Since</Th>
                <Th>Next key date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <p className="mb-2" style={{ fontSize: "1.125rem", fontWeight: 600 }}>No clients yet.</p>
                    <p className="text-[13px] text-muted">
                      Convert an approved submission to add your first engagement.
                    </p>
                  </td>
                </tr>
              ) : rows.map((c) => {
                const partnerName = c.services.find((s) => s.assignedPartner)?.assignedPartner?.fullName ?? "—";
                const nextKey = c.keyDates[0];
                return (
                  <tr
                    key={c.id}
                    className="group"
                    style={{ borderTop: "1px solid var(--admin-border)" }}
                  >
                    <Td>
                      <Link href={`/admin/clients/${c.id}`} className="block">
                        <span className="font-display text-[17px] tracking-[-0.005em] text-ink leading-tight block group-hover:text-accent-deep transition-colors duration-500">
                          {c.user.fullName}
                        </span>
                        <span className="block mt-0.5 font-mono text-[10px] tracking-[0.16em] uppercase text-muted">
                          {c.companyName ?? "—"}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5 flex-wrap">
                        {c.services.map((s) => (
                          <span
                            key={s.id}
                            className="font-mono text-[9.5px] tracking-[0.14em] uppercase px-2 py-1"
                            style={{
                              background: "var(--admin-bg)",
                              color: "var(--admin-fg)",
                              border: "1px solid var(--admin-border)",
                            }}
                          >
                            {shortService(s.serviceType)}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-[13px] text-ink">{partnerName}</Td>
                    <Td className="font-mono figure text-[12px] text-muted">
                      {c.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </Td>
                    <Td>
                      {nextKey ? (
                        <div>
                          <div className="text-[13px] text-ink leading-tight">{nextKey.description}</div>
                          <div
                            className={`font-mono figure text-[11px] tracking-[0.06em] mt-0.5 ${
                              nextKey.status === "overdue" ? "text-oxblood" : "text-accent-deep"
                            }`}
                          >
                            {nextKey.status === "overdue"
                              ? "OVERDUE"
                              : nextKey.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </div>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </Td>
                    <Td>
                      <span className={`badge ${clientStatusClass(c.status)}`}>
                        {prettyClientStatus(c.status)}
                      </span>
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
    <th className="text-left px-6 py-4 font-mono text-[9.5px] tracking-[0.24em] uppercase text-muted whitespace-nowrap font-medium">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-6 py-5 align-middle ${className}`}>{children}</td>;
}
function shortService(s: string) {
  return s === "company_formation" ? "Formation"
       : s === "tax_residency" ? "Tax"
       : s === "accounting" ? "Accounting"
       : s === "immigration" ? "Immigration"
       : s === "banking" ? "Banking"
       : s === "licensing" ? "Licensing"
       : s;
}
function prettyClientStatus(s: ClientStatus) {
  return s === "active" ? "Active" : s === "on_hold" ? "On Hold" : "Completed";
}
function clientStatusClass(s: ClientStatus) {
  return s === "active" ? "badge-approved" : s === "on_hold" ? "badge-pending" : "badge-done";
}
