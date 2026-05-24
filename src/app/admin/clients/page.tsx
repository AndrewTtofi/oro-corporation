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
      <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl flex items-center">
            Active Clients
            <span className="ml-3 font-mono text-meta px-2 py-0.5 rounded border border-admin-border text-admin-muted bg-admin-bg">
              {rows.length}
            </span>
          </h1>
          <p className="text-meta text-admin-muted mt-1">Manage ongoing relationships and service delivery.</p>
        </div>
        <ConvertModal candidates={approvedProspects.map((p) => ({
          prospectId: p.id,
          referenceNumber: p.referenceNumber,
          name: p.user.fullName,
          services: (Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : []),
          compliance: p.complianceFile?.status ?? "open",
        }))} />
      </div>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-1">
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

      <div className="bg-admin-surface border border-admin-border rounded-elem overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr style={{ background: "#FDFDFD" }}>
                <Th>Client Name</Th>
                <Th>Services Engaged</Th>
                <Th>Assigned Partner</Th>
                <Th>Client Since</Th>
                <Th>Next Key Date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-admin-muted text-meta">No clients yet.</td></tr>
              ) : rows.map((c) => {
                const partnerName = c.services.find((s) => s.assignedPartner)?.assignedPartner?.fullName ?? "—";
                const nextKey = c.keyDates[0];
                return (
                  <tr key={c.id} className="border-t border-admin-border hover:bg-admin-bg cursor-pointer">
                    <Td>
                      <Link href={`/admin/clients/${c.id}`} className="block">
                        <span className="font-semibold block text-dark">{c.user.fullName}</span>
                        <span className="text-[12px] text-admin-muted">{c.companyName ?? "—"}</span>
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex gap-1 flex-wrap">
                        {c.services.map((s) => (
                          <span key={s.id} className="text-[11px] rounded-[3px] px-1.5 py-0.5"
                                style={{ background: "#F3F4F6", color: "#4B5563" }}>{shortService(s.serviceType)}</span>
                        ))}
                      </div>
                    </Td>
                    <Td>{partnerName}</Td>
                    <Td className="font-mono text-meta text-admin-muted">{c.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</Td>
                    <Td>
                      {nextKey ? (
                        <>
                          <div className="text-meta">{nextKey.description}</div>
                          <div className={`font-mono text-meta ${nextKey.status === "overdue" ? "text-[#DC2626]" : "text-accent font-semibold"}`}>
                            {nextKey.status === "overdue" ? "Overdue" : nextKey.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </div>
                        </>
                      ) : <span className="text-admin-muted">—</span>}
                    </Td>
                    <Td><span className={`badge ${clientStatusClass(c.status)}`}>{prettyClientStatus(c.status)}</span></Td>
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
  return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-admin-muted font-semibold whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-4 align-middle text-meta ${className}`}>{children}</td>;
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
