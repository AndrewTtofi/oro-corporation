import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConversationView } from "@/app/admin/clients/[id]/ConversationView";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { listThread } from "@/lib/services/messages";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await requireRole("staff");
  const sp = await searchParams;

  const clients = await prisma.client.findMany({
    include: {
      user: { select: { fullName: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  // Most-recently-active threads first; clients with no messages sink to the bottom.
  clients.sort((a, b) => {
    const ta = a.messages[0]?.createdAt.getTime() ?? 0;
    const tb = b.messages[0]?.createdAt.getTime() ?? 0;
    return tb - ta;
  });

  const selectedId = sp.c ?? clients[0]?.id ?? null;
  const selected = clients.find((c) => c.id === selectedId) ?? null;
  const thread = selected ? await listThread(selected.id) : [];

  return (
    <AdminShell active="messages">
      <div className="mb-8">
        <div className="eyebrow mb-2">Client inbox</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Messages</h2>
      </div>

      {clients.length === 0 ? (
        <div className="empty"><h3>No client conversations yet</h3><p>Once a prospect is converted to a client, your conversation appears here.</p></div>
      ) : (
        <div className="tbl-wrap" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 560 }}>
            {/* Thread list */}
            <div style={{ borderRight: "1px solid var(--admin-border)", overflow: "auto" }}>
              {clients.map((c) => {
                const last = c.messages[0];
                const active = c.id === selectedId;
                const initials = c.user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <Link
                    key={c.id}
                    href={`/admin/messages?c=${c.id}`}
                    className="row"
                    style={{
                      alignItems: "flex-start", gap: 10, padding: "12px 14px",
                      borderBottom: "1px solid var(--admin-border)",
                      background: active ? "var(--brand-50)" : "transparent",
                      textDecoration: "none", color: "var(--text)",
                    }}
                  >
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{c.user.fullName}</div>
                      <div className="muted" style={{ fontSize: "var(--fs-xs)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {last ? last.body : "No messages yet"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Conversation */}
            <div style={{ padding: "var(--space-6)" }}>
              {selected ? (
                <ConversationView clientId={selected.id} clientName={selected.user.fullName} messages={thread} />
              ) : (
                <div className="empty"><h3>Select a conversation</h3><p>Pick a client on the left to view the thread.</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
