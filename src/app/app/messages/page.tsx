import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getMessagesForUser } from "@/lib/services/client-portal";
import { MessageComposer } from "./MessageComposer";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser();
  const [prospect, client, messages] = await Promise.all([
    prisma.prospect.findUnique({ where: { userId: user.id }, select: { id: true, status: true } }),
    prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } }),
    getMessagesForUser(user.id),
  ]);
  if (!prospect && !client) redirect("/onboarding");

  const isApproved = (prospect?.status === "approved") || !!client;

  return (
    <ClientShell active="messages" approved={isApproved}>
      <div className="max-w-[800px]">
        <div className="mb-10">
          <p className="eyebrow mb-2">Messages</p>
          <h1 className="font-display text-3xl">Conversation with the ORO team</h1>
          <p className="text-muted mt-2 text-meta">
            We&apos;ll reach out here if we need anything else. You can also send us a note at any time.
          </p>
        </div>

        <div className="bg-[var(--client-surface)] border border-token rounded-card p-6 mb-6 flex flex-col gap-4">
          {messages.length === 0 && <p className="text-muted text-meta">No messages yet. Send the first one below.</p>}
          {messages.map((m) => {
            const isMine = m.senderId === user.id;
            const isStaff = m.sender?.role === "staff";
            const bubbleCls = isMine
              ? "bg-accent text-dark"
              : isStaff
                ? "bg-dark text-white"
                : "bg-[var(--client-bg)]";
            const label = isStaff
              ? `${m.sender?.fullName ?? "ORO team"} · ORO Staff`
              : (m.sender?.fullName ?? "ORO team");
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <div className="text-[11px] text-muted">
                  {label} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <div className={`mt-1 rounded-card px-4 py-2 max-w-[70%] ${bubbleCls}`}>
                  <p className="text-meta whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <MessageComposer />
      </div>
    </ClientShell>
  );
}
