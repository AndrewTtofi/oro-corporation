import { notFound } from "next/navigation";
import { AdminClientShell } from "../AdminClientShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { listThread } from "@/lib/services/messages";
import { MessageComposer } from "./MessageComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, include: { user: true } });
  if (!client) notFound();

  const messages = await listThread(id);

  return (
    <AdminClientShell breadcrumb={`${client.user.fullName} · Messages`}>
      <div className="max-w-[800px]">
        <h1 className="font-display text-2xl mb-6">Messages with {client.user.fullName}</h1>

        <div className="bg-admin-surface border border-admin-border rounded-card p-6 mb-6 flex flex-col gap-4">
          {messages.length === 0 && <p className="text-meta text-admin-muted">No messages yet. Send the first one below.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender.role === "staff" ? "items-end" : "items-start"}`}>
              <div className="text-[11px] text-admin-muted">{m.sender.fullName} · {new Date(m.createdAt).toLocaleString()}</div>
              <div className={`mt-1 rounded-card px-4 py-2 max-w-[70%] ${m.sender.role === "staff" ? "bg-accent text-dark" : "bg-admin-bg"}`}>
                <p className="text-meta whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))}
        </div>

        <MessageComposer clientId={id} />
      </div>
    </AdminClientShell>
  );
}
