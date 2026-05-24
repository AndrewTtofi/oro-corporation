import { notFound } from "next/navigation";
import { AdminClientShell } from "../AdminClientShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { RequestForm } from "./RequestForm";
import { CancelRequestClient } from "../CancelRequestClient";

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
        <h1 className="font-display text-2xl mb-6">Request documents from {client.user.fullName}</h1>
        <RequestForm clientId={id} taxonomy={taxonomy} />

        <h2 className="font-display text-xl mt-10 mb-4">History</h2>
        <div className="bg-admin-surface border border-admin-border rounded-card p-4">
          <ul className="flex flex-col gap-3">
            {client.documentRequests.length === 0 && <p className="text-meta text-admin-muted">No requests yet.</p>}
            {client.documentRequests.map((r) => (
              <li key={r.id} className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-meta">{r.description}</div>
                  <div className="text-[12px] text-admin-muted">
                    {r.serviceTypeKey ? `Service: ${r.serviceTypeKey} · ` : ""}
                    {r.dueAt ? `Due ${new Date(r.dueAt).toLocaleDateString()} · ` : ""}
                    State: <span className="font-mono">{r.state}</span>
                  </div>
                </div>
                {r.state === "open" && <CancelRequestClient id={r.id} />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminClientShell>
  );
}
