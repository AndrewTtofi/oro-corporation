import Link from "next/link";
import { PartnerShell } from "@/components/admin/PartnerShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getBranding } from "@/lib/services/branding";

export const metadata = { title: "My clients" };

export default async function PartnerClientsList() {
  const user = await requireRole("partner");
  const { brandName } = await getBranding();

  // Clients where this partner is assigned to at least one ClientService.
  const services = await prisma.clientService.findMany({
    where: { assignedPartnerId: user.id },
    select: { clientId: true },
  });
  const clientIds = Array.from(new Set(services.map((s) => s.clientId)));

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    include: {
      user: true,
      services: true,
      keyDates: { where: { status: { in: ["upcoming", "overdue"] } }, orderBy: { dueDate: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PartnerShell active="clients">
      <h1 className="text-2xl font-bold mb-2">My Clients</h1>
      <p className="text-meta text-admin-muted mb-8">
        Clients you&apos;ve been assigned to. Read-only view; reach out to {brandName} staff for changes.
      </p>

      {clients.length === 0 ? (
        <div className="bg-admin-surface border border-admin-border rounded-card p-12 text-center text-admin-muted text-meta">
          You haven&apos;t been assigned to any clients yet.
        </div>
      ) : (
        <div className="bg-admin-surface border border-admin-border rounded-elem overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr style={{ background: "#FDFDFD" }}>
                  <Th>Client</Th>
                  <Th>Services</Th>
                  <Th>Client Since</Th>
                  <Th>Next Key Date</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const myServices = c.services.filter((s) => s.assignedPartnerId === user.id);
                  const next = c.keyDates[0];
                  return (
                    <tr key={c.id} className="border-t border-admin-border hover:bg-admin-bg">
                      <Td>
                        <Link href={`/partner/clients/${c.id}`} className="block">
                          <span className="font-semibold block">{c.user.fullName}</span>
                          <span className="text-[12px] text-admin-muted">{c.companyName ?? "—"}</span>
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex gap-1 flex-wrap">
                          {myServices.map((s) => (
                            <span key={s.id} className="text-[11px] rounded-[3px] px-1.5 py-0.5"
                                  style={{ background: "#F3F4F6", color: "#4B5563" }}>{pretty(s.serviceType)}</span>
                          ))}
                        </div>
                      </Td>
                      <Td className="font-mono text-meta text-admin-muted">
                        {c.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </Td>
                      <Td>
                        {next ? (
                          <>
                            <div className="text-meta">{next.description}</div>
                            <div className={`font-mono text-meta ${next.status === "overdue" ? "text-[#DC2626]" : "text-accent font-semibold"}`}>
                              {next.status === "overdue" ? "Overdue" : next.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </div>
                          </>
                        ) : <span className="text-admin-muted">—</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PartnerShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-admin-muted font-semibold whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-4 align-middle text-meta ${className}`}>{children}</td>;
}
function pretty(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
