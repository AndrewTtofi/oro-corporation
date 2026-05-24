import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { ClientStatus, SvcStatus, KeyDateStatus, Role } from "@prisma/client";
import { AdminClientShell } from "./AdminClientShell";
import { ClientHeader } from "./ClientHeader";
import { ClientStatusPanel } from "./ClientStatusPanel";
import { ClientNotes } from "./ClientNotes";
import { ClientActivity } from "./ClientActivity";

export const metadata = { title: "Client profile" };

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      user: true,
      primaryStaff: true,
      services: { include: { assignedPartner: true } },
      keyDates: { orderBy: { dueDate: "asc" } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      prospect: { include: { documents: true } },
    },
  });
  if (!client) notFound();

  const activity = await prisma.activityLog.findMany({
    where: { OR: [{ entityType: "client", entityId: client.id }, { entityType: "prospect", entityId: client.prospectId }] },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { actor: true },
  });

  const bookings = await prisma.booking.findMany({
    where: { prospectId: client.prospectId },
    orderBy: { startsAt: "desc" },
    include: { expert: true },
  });

  const partners = await prisma.user.findMany({ where: { role: Role.partner }, select: { id: true, fullName: true } });
  const initials = client.user.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const folders = folderSummary(client.services.map((s) => s.serviceType), client.prospect.documents.length);

  return (
    <AdminClientShell breadcrumb={client.user.fullName}>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px] items-start max-w-[1200px]">
        <div>
          <ClientHeader
            initials={initials}
            name={client.user.fullName}
            company={client.companyName ?? "—"}
            reference={client.prospect.referenceNumber}
            since={client.createdAt}
            country={"—"}
            phone={client.user.phone ?? "—"}
            email={client.user.email}
          />

          <Heading>Services Engaged</Heading>
          {client.services.length === 0 ? <p className="text-meta text-admin-muted">No services yet.</p> :
            client.services.map((s) => (
              <ServiceRow
                key={s.id}
                name={prettyService(s.serviceType)}
                started={s.startDate ?? client.createdAt}
                partner={s.assignedPartner?.fullName ?? "Unassigned"}
                status={s.status}
                notes={s.notes ?? ""}
              />
            ))}

          <Heading className="mt-8">Key Dates &amp; Reminders</Heading>
          <div className="bg-admin-surface border border-admin-border rounded-card p-6">
            <div className="flex flex-col gap-4">
              {client.keyDates.length === 0 ? <p className="text-meta text-admin-muted">No key dates yet.</p> :
                client.keyDates.map((kd) => <KeyDateRow key={kd.id} kd={{ id: kd.id, description: kd.description, dueDate: kd.dueDate, status: kd.status }} />)}
            </div>
            <AddKeyDateForm clientId={client.id} />
          </div>

          <Heading className="mt-8">Documents</Heading>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {folders.map((f) => (
              <Link
                key={f.label}
                href={`#docs-${f.label.replace(/\s+/g, "-").toLowerCase()}`}
                className="bg-admin-surface border border-admin-border rounded-elem p-4 text-center hover:border-accent transition-colors"
              >
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-2 text-accent">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div className="text-meta font-medium">{f.label}</div>
                <div className="text-[11px] text-admin-muted">{f.count} {f.count === 1 ? "file" : "files"}</div>
              </Link>
            ))}
          </div>

          <Heading className="mt-8">Consultation History</Heading>
          <div className="bg-admin-surface border border-admin-border rounded-card p-6">
            {bookings.length === 0 ? <p className="text-meta text-admin-muted">No consultations yet.</p> :
              <div className="flex flex-col">
                {bookings.map((b, i) => (
                  <div key={b.id} className={`flex gap-4 items-start ${i < bookings.length - 1 ? "border-b border-admin-border pb-4" : ""} ${i > 0 ? "pt-4" : ""}`}>
                    <div className="font-mono text-[12px] text-accent font-semibold w-[100px] shrink-0">
                      {b.startsAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{b.status === "completed" ? "Past consultation" : "Upcoming consultation"}</div>
                      <div className="text-[13px] text-admin-muted mt-1">Expert: {b.expert.fullName}</div>
                      <div className="text-[13px] mt-2">Status: {prettyBooking(b.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <ClientStatusPanel
            clientId={client.id}
            status={client.status}
            primaryStaff={{ id: client.primaryStaff.id, name: client.primaryStaff.fullName, role: "Primary Contact / Partner" }}
            extras={Array.from(
              new Map(
                client.services
                  .filter((s) => s.assignedPartner && s.assignedPartner.id !== client.primaryStaff.id)
                  .map((s) => [s.assignedPartner!.id, { id: s.assignedPartner!.id, name: s.assignedPartner!.fullName, role: "Assigned Partner" }]),
              ).values(),
            )}
            partners={partners}
          />

          <ClientNotes
            clientId={client.id}
            initial={client.internalNotes.map((n) => ({
              id: n.id,
              author: n.author.fullName,
              body: n.body,
              createdAt: n.createdAt.toISOString(),
            }))}
          />

          <ClientActivity
            entries={activity.map((a) => ({
              id: a.id,
              action: a.action,
              actor: a.actor?.fullName ?? "System",
              createdAt: a.createdAt.toISOString(),
            }))}
          />

          <div>
            <div className="text-[12px] font-bold uppercase text-admin-muted tracking-widest mb-3">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction label="Send Message" href={`/admin/clients/${client.id}/message`} />
              <QuickAction label="Request Docs" href={`/admin/clients/${client.id}/request-docs`} />
              <AddServiceAction clientId={client.id} />
              <AddKeyDateInlineAction />
            </div>
          </div>
        </div>
      </div>
    </AdminClientShell>
  );
}

function Heading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-meta font-bold uppercase tracking-widest text-admin-muted mb-4 mt-4 flex items-center gap-3 ${className}`}>
      {children}
      <span className="flex-1 h-px bg-admin-border" />
    </div>
  );
}

function ServiceRow({ name, started, partner, status, notes }: { name: string; started: Date; partner: string; status: SvcStatus; notes: string }) {
  const badge = status === "in_progress" ? { cls: "badge-pending", label: "In Progress" }
              : status === "completed" ? { cls: "badge-done", label: "Completed" }
              : { cls: "badge-info", label: "Pending Approval" };
  return (
    <div className="border border-admin-border rounded-elem p-4 mb-3 grid gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-[13px] text-admin-muted mt-1">Started {started.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · Assigned: {partner}</div>
        {notes && <div className="text-[12px] mt-2">Status: {notes}</div>}
      </div>
      <div><span className={`badge ${badge.cls}`}>{badge.label}</span></div>
    </div>
  );
}

function KeyDateRow({ kd }: { kd: { id: string; description: string; dueDate: Date; status: KeyDateStatus } }) {
  const upcoming = kd.status === "upcoming";
  const overdue = kd.status === "overdue";
  return (
    <div className="flex gap-4">
      <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
           style={{
             background: overdue ? "#DC2626" : upcoming ? "var(--accent)" : "var(--border)",
           }} />
      <div className="text-[14px]">
        <div className="font-mono text-[12px] text-accent font-semibold">{kd.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
        <div className={`font-semibold ${overdue ? "text-[#DC2626]" : ""}`}>{kd.description}</div>
        <div className="text-[12px] text-admin-muted">{overdue ? "Overdue" : upcoming ? "Upcoming" : "Completed"}</div>
      </div>
    </div>
  );
}

function AddKeyDateForm({ clientId }: { clientId: string }) {
  return (
    <form
      action={`/api/admin/clients/${clientId}/key-dates`}
      method="POST"
      className="mt-6 grid gap-2 grid-cols-[1fr_auto_auto]"
    >
      <input name="description" placeholder="Description (e.g. Annual return)" className="px-3 py-2 rounded-inner text-meta" style={{ border: "1px solid var(--border)" }} required />
      <input name="dueDate" type="date" className="px-3 py-2 rounded-inner text-meta" style={{ border: "1px solid var(--border)" }} required />
      <button type="submit" className="btn btn-primary px-4 py-2 text-meta">+ Add</button>
    </form>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center hover:border-accent hover:text-accent">
      {label}
    </Link>
  );
}

function AddServiceAction({ clientId }: { clientId: string }) {
  return (
    <Link href={`/admin/clients/${clientId}#add-service`} className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center hover:border-accent hover:text-accent">
      Add Service
    </Link>
  );
}

function AddKeyDateInlineAction() {
  return (
    <span className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center">
      Add Key Date ↑
    </span>
  );
}

function folderSummary(services: string[], totalDocs: number): { label: string; count: number }[] {
  const map = new Map<string, number>();
  map.set("KYC Documents", Math.min(totalDocs, 2));
  for (const s of services) {
    const label = prettyService(s);
    map.set(label, 0);
  }
  map.set("Correspondence", 0);
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

function prettyService(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function prettyBooking(s: string) {
  return s === "confirmed" ? "Confirmed"
       : s === "completed" ? "Completed"
       : s === "no_show" ? "No show"
       : "Cancelled";
}
