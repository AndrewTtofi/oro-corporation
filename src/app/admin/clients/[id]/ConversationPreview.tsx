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
    <section className="surface p-7">
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <div className="eyebrow mb-2">Recent correspondence</div>
          <h3 className="font-display text-[22px] leading-[1.2] tracking-[-0.015em] text-ink">
            Conversation
          </h3>
        </div>
        <Link
          href={`?tab=conversation`}
          className="font-mono text-[10px] tracking-[0.22em] uppercase text-accent-deep link-gold"
        >
          Open thread →
        </Link>
      </header>

      {recent.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted mb-2" style={{ fontSize: "0.9375rem" }}>No messages yet.</p>
          <Link
            href={`?tab=conversation`}
            className="font-mono text-[10px] tracking-[0.22em] uppercase text-accent-deep link-gold"
          >
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
              <li
                key={m.id}
                className={`py-4 ${isLast ? "" : "border-b border-token"}`}
                style={isLast ? {} : { borderColor: "var(--admin-border)" }}
              >
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-display text-[14px] tracking-[-0.005em] text-ink">
                    {m.sender.fullName}
                  </span>
                  <span className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-muted">
                    {fromStaff ? "Counsel" : "Client"}
                  </span>
                  <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-muted ml-auto figure">
                    {time}
                  </span>
                </div>
                <p
                  className="text-[14px] leading-[1.55] text-ink/85 line-clamp-2"
                  style={{
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
        <div className="mt-5 pt-5 border-t border-token" style={{ borderColor: "var(--admin-border)" }}>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-oxblood">
            {unreadCount} unread
          </span>
        </div>
      )}
    </section>
  );
}
