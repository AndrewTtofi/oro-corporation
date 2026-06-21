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
      <div className="row-between mb-6" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow mb-2">Engagements</div>
          <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Active clients</h2>
          <div className="muted mono mt-3" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".12em" }}>
            {rows.length} on roster
            {approvedProspects.length > 0 && <> · {approvedProspects.length} awaiting conversion</>}
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

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="row mb-6" style={{ gap: "1rem", flexWrap: "wrap" }}>
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
      {rows.length === 0 ? (
        <div className="empty">
          <h3>No clients yet</h3>
          <p>Convert an approved submission to add your first engagement.</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <div className="tbl-toolbar">
            <strong>Clients</strong>
            <span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{rows.length}</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Services</th>
                <th>Partner</th>
                <th>Since</th>
                <th>Next key date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const partnerName = c.services.find((s) => s.assignedPartner)?.assignedPartner?.fullName ?? "—";
                const nextKey = c.keyDates[0];
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/clients/${c.id}`} style={{ display: "block" }}>
                        <div style={{ fontWeight: 600 }}>{c.user.fullName}</div>
                        <div className="muted mono" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".1em" }}>
                          {c.companyName ?? "—"}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div className="row" style={{ gap: ".35rem", flexWrap: "wrap" }}>
                        {c.services.map((s) => (
                          <span key={s.id} className="badge badge-neutral">{shortService(s.serviceType)}</span>
                        ))}
                      </div>
                    </td>
                    <td>{partnerName}</td>
                    <td className="mono muted" style={{ fontSize: "var(--fs-xs)" }}>
                      {c.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td>
                      {nextKey ? (
                        <div>
                          <div>{nextKey.description}</div>
                          <div className="mono" style={{ fontSize: "var(--fs-2xs)", marginTop: "2px" }}>
                            {nextKey.status === "overdue" ? (
                              <span className="badge badge-danger">Overdue</span>
                            ) : (
                              <span className="muted">
                                {nextKey.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${clientStatusClass(c.status)}`}>
                        {prettyClientStatus(c.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
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
