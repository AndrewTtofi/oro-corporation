import { notFound } from "next/navigation";
import { AdminClientShell } from "../AdminClientShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { RequestForm } from "./RequestForm";
import { CancelRequestClient } from "../CancelRequestClient";
import { EditRequestClient } from "./EditRequestClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request documents" };

export default async function RequestDocsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { user: true, services: true, documentRequests: { orderBy: { createdAt: "desc" }, include: { fulfilledDocument: true } } },
  });
  if (!client) notFound();
  const taxonomy = await prisma.service.findMany({ where: { active: true }, select: { key: true, label: true }, orderBy: { sortOrder: "asc" } });

  return (
    <AdminClientShell breadcrumb={`${client.user.fullName} · Request docs`}>
      <div className="max-w-[800px]">
        <div className="eyebrow mb-2">Compliance</div>
        <h1 className="mb-6" style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Request documents from {client.user.fullName}</h1>
        <RequestForm clientId={id} taxonomy={taxonomy} />

        <h2 className="card-title mt-10">History</h2>
        <div className="card">
          {client.documentRequests.length === 0 ? (
            <div className="empty"><h3>No requests yet</h3><p>Document requests you send appear here.</p></div>
          ) : (
            <ul className="flex flex-col gap-3">
              {client.documentRequests.map((r) => (
                <li key={r.id} className="row-between" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{r.description}</div>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {r.serviceTypeKey ? `Service: ${r.serviceTypeKey} · ` : ""}
                      {r.dueAt ? `Due ${new Date(r.dueAt).toLocaleDateString()} · ` : ""}
                      State: <span className={`badge ${r.state === "open" ? "badge-pending" : "badge-neutral"}`}>{r.state}</span>
                    </div>
                  </div>
                  {r.state === "open" && (
                    <div className="row gap-2 shrink-0">
                      <EditRequestClient id={r.id} description={r.description} dueAt={r.dueAt?.toISOString() ?? null} />
                      <CancelRequestClient id={r.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminClientShell>
  );
}
