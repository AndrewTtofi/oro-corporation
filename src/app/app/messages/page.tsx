import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { getProspectForUser } from "@/lib/services/client-view";
import { MessageComposer } from "./MessageComposer";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser();
  const prospect = await getProspectForUser(user.id);
  if (!prospect) redirect("/onboarding");
  const isApproved = prospect.status === "approved";
  const messages = [...prospect.messages].reverse();

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

        <div className="surface rounded-card flex flex-col" style={{ minHeight: 480 }}>
          <ul className="flex flex-col gap-6 p-6 flex-1">
            {messages.length === 0 ? (
              <li className="text-meta text-muted text-center py-20">No messages yet.</li>
            ) : messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-elem px-4 py-3 ${mine ? "" : "border"}`}
                       style={mine
                         ? { background: "var(--accent)", color: "var(--dark)" }
                         : { background: "var(--bg)", borderColor: "var(--border)" }}>
                    <div className="text-[12px] opacity-70 mb-1 font-medium">
                      {mine ? "You" : m.sender.fullName} · {m.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                    <div className="text-meta whitespace-pre-wrap">{m.body}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
            <MessageComposer prospectId={prospect.id} />
          </div>
        </div>
      </div>
    </ClientShell>
  );
}
