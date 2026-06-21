import Link from "next/link";

type Message = {
  id: string;
  body: string;
  createdAt: Date | string;
  sender: { id: string; fullName: string; role: string };
};

export function ConversationPreview({
  clientId,
  messages,
  unreadCount,
}: {
  clientId: string;
  messages: Message[];
  unreadCount?: number;
}) {
  // Last 3 messages, newest first for preview legibility
  const recent = [...messages].slice(-3).reverse();

  return (
    <section className="card">
      <header className="row-between mb-5" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow mb-2">Recent correspondence</div>
          <h3 className="card-title" style={{ marginBottom: 0 }}>Conversation</h3>
        </div>
        <Link href={`?tab=conversation`} className="link-gold eyebrow">
          Open thread →
        </Link>
      </header>

      {recent.length === 0 ? (
        <div className="py-8 text-center">
          <p className="muted mb-2" style={{ fontSize: "0.9375rem" }}>No messages yet.</p>
          <Link href={`?tab=conversation`} className="link-gold eyebrow">
            Send the first message →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col">
          {recent.map((m, i) => {
            const fromStaff = m.sender.role === "staff" || m.sender.role === "partner";
            const time = new Date(m.createdAt).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            const isLast = i === recent.length - 1;
            return (
              <li key={m.id} className="py-4" style={isLast ? {} : { borderBottom: "1px solid var(--border)" }}>
                <div className="row gap-3 mb-2">
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    {m.sender.fullName}
                  </span>
                  <span className="eyebrow">
                    {fromStaff ? "Counsel" : "Client"}
                  </span>
                  <span className="eyebrow mono" style={{ marginLeft: "auto" }}>
                    {time}
                  </span>
                </div>
                <p
                  className="muted"
                  style={{
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {m.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {unreadCount && unreadCount > 0 && (
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="badge badge-rejected">{unreadCount} unread</span>
        </div>
      )}
    </section>
  );
}
