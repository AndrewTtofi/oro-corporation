import { notFound } from "next/navigation";
import Link from "next/link";
import { PartnerShell } from "@/components/admin/PartnerShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getBranding } from "@/lib/services/branding";
import { PartnerNoteForm } from "./PartnerNoteForm";

export const metadata = { title: "Client profile" };

export default async function PartnerClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("partner");
  const { id } = await params;
  const { brandName } = await getBranding();

  // Authorization: partner must be assigned to at least one ClientService on this client.
  const link = await prisma.clientService.findFirst({
    where: { clientId: id, assignedPartnerId: user.id },
    select: { id: true },
  });
  if (!link) notFound();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      user: true,
      services: { include: { assignedPartner: true } },
      keyDates: { orderBy: { dueDate: "asc" } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      prospect: { include: { documents: { orderBy: { uploadedAt: "asc" } } } },
    },
  });
  if (!client) notFound();

  const initials = client.user.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <PartnerShell active="clients">
      <nav className="text-[13px] text-admin-muted flex items-center gap-2 mb-6">
        <Link href="/partner" className="text-accent font-medium">My Clients</Link>
        <span>/</span>
        <span className="text-admin-fg font-semibold">{client.user.fullName}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] max-w-[1200px]">
        <div>
          <div className="bg-admin-surface border border-admin-border rounded-card p-6 flex gap-6 items-center mb-6">
            <div className="w-20 h-20 rounded-card grid place-items-center font-display font-bold text-3xl"
                 style={{ background: "var(--dark)", color: "var(--accent)" }}>
              {initials}
            </div>
            <div>
              <h1 className="font-display text-3xl">{client.user.fullName}</h1>
              <div className="text-meta text-admin-muted mt-1">
                <b className="text-admin-fg">{client.companyName ?? "—"}</b> · Ref: <span className="font-mono">{client.prospect.referenceNumber}</span>
              </div>
              <div className="text-meta text-admin-muted">✉️ {client.user.email}{client.user.phone ? ` · 📞 ${client.user.phone}` : ""}</div>
            </div>
          </div>

          <Heading>Services I&apos;m assigned to</Heading>
          {client.services.filter((s) => s.assignedPartnerId === user.id).map((s) => (
            <div key={s.id} className="border border-admin-border rounded-elem p-4 mb-3">
              <div className="flex justify-between items-start gap-3">
                <div className="font-semibold">{pretty(s.serviceType)}</div>
                <span className="badge badge-info">{prettySvcStatus(s.status)}</span>
              </div>
              <div className="text-[13px] text-admin-muted mt-1">
                {s.startDate ? `Started ${s.startDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : "Not started"}
              </div>
              {s.notes && <div className="text-[13px] mt-2">{s.notes}</div>}
            </div>
          ))}

          <Heading className="mt-8">Documents</Heading>
          {client.prospect.documents.length === 0 ? (
            <p className="text-meta text-admin-muted">No documents yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {client.prospect.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-3 p-3 rounded-inner text-meta border border-admin-border hover:border-accent hover:bg-admin-bg">
                    <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium flex-1 truncate">{d.originalName}</span>
                    <span className="text-[12px] text-admin-muted">{prettyType(d.type)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <Heading className="mt-8">Key Dates</Heading>
          {client.keyDates.length === 0 ? <p className="text-meta text-admin-muted">No key dates set.</p> :
            <div className="bg-admin-surface border border-admin-border rounded-card p-6 flex flex-col gap-4">
              {client.keyDates.map((kd) => (
                <div key={kd.id} className="flex gap-4">
                  <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                       style={{ background: kd.status === "overdue" ? "#DC2626" : kd.status === "upcoming" ? "var(--accent)" : "var(--border)" }} />
                  <div className="text-meta">
                    <div className="font-mono text-[12px] text-accent font-semibold">
                      {kd.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                    </div>
                    <div className={`font-semibold ${kd.status === "overdue" ? "text-[#DC2626]" : ""}`}>{kd.description}</div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>

        <aside className="lg:sticky lg:top-24 flex flex-col gap-6">
          <section className="bg-admin-surface border border-admin-border rounded-card">
            <div className="px-6 py-4 border-b border-admin-border" style={{ background: "#FDFDFD" }}>
              <h3 className="font-bold text-base">Internal Notes</h3>
              <p className="text-[11px] text-admin-muted mt-1">Visible to {brandName} staff and partners. You can add notes but cannot delete.</p>
            </div>
            <div className="p-6">
              <PartnerNoteForm clientId={client.id} />
              <ul className="mt-5 flex flex-col gap-3">
                {client.internalNotes.length === 0 ? <li className="text-meta text-admin-muted">No notes yet.</li> :
                  client.internalNotes.map((n) => (
                    <li key={n.id} className="rounded-elem p-3 text-[13px] leading-relaxed" style={{ background: "var(--bg)" }}>
                      {n.body}
                      <div className="flex justify-between text-[11px] text-admin-muted mt-2">
                        <span>{n.author.fullName}</span>
                        <span className="font-mono">{n.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </PartnerShell>
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

function pretty(s: string) { return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "); }
function prettyType(s: string) { return s === "passport" ? "Passport" : s === "proof_of_address" ? "Address" : "Other"; }
function prettySvcStatus(s: string) {
  return s === "in_progress" ? "In Progress" : s === "completed" ? "Completed" : "Pending";
}
