import { MessageComposer } from "./messages/MessageComposer";

type Message = {
  id: string;
  body: string;
  createdAt: Date | string;
  sender: { id: string; fullName: string; role: string };
};

export function ConversationView({
  clientId,
  clientName,
  messages,
}: {
  clientId: string;
  clientName: string;
  messages: Message[];
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-10 max-w-[1100px]">
      {/* ── Main thread column ──────────────────────────────────── */}
      <section>
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <div className="eyebrow mb-3">Correspondence</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em" }}>With {clientName}</h2>
          </div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </div>
        </div>

        {/* Thread surface */}
        <div
          className="surface px-8 py-10 max-h-[640px] overflow-y-auto flex flex-col gap-8"
          style={{ scrollSnapType: "y proximity" }}
        >
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="mb-3" style={{ fontSize: "1.25rem", fontWeight: 600 }}>No correspondence yet.</div>
              <p className="text-muted text-[14px] max-w-[42ch] mx-auto">
                Send the first message below. The client will receive it in
                their portal and via email.
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            const fromStaff = m.sender.role === "staff" || m.sender.role === "partner";
            const prev = messages[i - 1];
            const grouped = prev && prev.sender.id === m.sender.id &&
              (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000);
            return (
              <Bubble key={m.id} message={m} fromStaff={fromStaff} grouped={Boolean(grouped)} />
            );
          })}
        </div>

        {/* Composer */}
        <div className="mt-6">
          <MessageComposer clientId={clientId} />
        </div>
      </section>

      {/* ── Sidebar — guidance ─────────────────────────────────── */}
      <aside className="hidden xl:block">
        <div className="surface p-7">
          <div className="eyebrow mb-4">About this thread</div>
          <h3 className="font-display text-[20px] leading-tight text-ink mb-4">
            One conversation per client.
          </h3>
          <ul className="flex flex-col gap-4 text-[13px] text-muted leading-relaxed">
            <li className="flex gap-3">
              <span className="text-accent-deep mt-0.5">·</span>
              <span>
                The client sees every staff message in their portal and via
                email.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent-deep mt-0.5">·</span>
              <span>
                Internal notes are <em>not</em> visible to the client — those
                live under Activity.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent-deep mt-0.5">·</span>
              <span>
                Messages cannot be edited or deleted once sent.
              </span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Bubble({
  message,
  fromStaff,
  grouped,
}: {
  message: Message;
  fromStaff: boolean;
  grouped: boolean;
}) {
  const initials = message.sender.fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const time = new Date(message.createdAt).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex gap-4 ${fromStaff ? "flex-row-reverse" : ""} ${grouped ? "" : "scroll-mt-8"}`}
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Avatar — only on first message in a group */}
      <div className="w-9 h-9 shrink-0">
        {!grouped && (
          <div
            className="w-9 h-9 grid place-items-center font-mono text-[10px] tracking-[0.08em] uppercase"
            style={{
              background: fromStaff ? "var(--brand)" : "var(--surface-2)",
              color: fromStaff ? "#fff" : "var(--fg)",
              borderRadius: "999px",
              boxShadow: fromStaff
                ? "0 0 0 1px rgba(176,141,62,0.4)"
                : "0 0 0 1px rgba(229,221,201,0.8)",
            }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[72%] flex flex-col ${fromStaff ? "items-end" : "items-start"}`}>
        {!grouped && (
          <div className="flex items-baseline gap-3 mb-1.5">
            <span className="font-display text-[14px] tracking-[-0.005em] text-ink">
              {message.sender.fullName}
            </span>
            <span className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-muted">
              {fromStaff ? "Counsel" : "Client"}
            </span>
          </div>
        )}
        <div
          className="px-5 py-3.5 text-[14.5px] leading-[1.55] whitespace-pre-wrap"
          style={{
            background: fromStaff ? "var(--brand)" : "var(--surface-2)",
            color: fromStaff ? "#fff" : "var(--fg)",
            border: fromStaff ? "1px solid var(--brand)" : "1px solid var(--border)",
            borderRadius: "2px",
            boxShadow: fromStaff
              ? "0 1px 0 rgba(176,141,62,0.2), 0 14px 28px -16px rgba(60,40,16,0.3)"
              : "0 1px 0 rgba(229,221,201,0.6)",
          }}
        >
          {message.body}
        </div>
        <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-muted mt-1.5 figure">
          {time}
        </div>
      </div>
    </div>
  );
}
