interface Entry { id: string; action: string; actor: string; createdAt: string }

export function ClientActivity({ entries }: { entries: Entry[] }) {
  return (
    <section className="bg-admin-surface border border-admin-border rounded-card">
      <div className="px-6 py-4 border-b border-admin-border" style={{ background: "#FDFDFD" }}>
        <h3 className="font-bold text-base">Activity Log</h3>
      </div>
      <div className="p-6 flex flex-col gap-3">
        {entries.length === 0 ? (
          <p className="text-meta text-admin-muted">No activity yet.</p>
        ) : entries.map((e) => (
          <div key={e.id} className="flex gap-3 text-[12px]">
            <span className="w-1.5 h-1.5 mt-2 rounded-full shrink-0" style={{ background: "var(--border)" }} />
            <div>
              <div className="text-admin-muted">
                <b className="text-admin-fg">{prettyAction(e.action)}</b>
                {" "}— {e.actor}
              </div>
              <div className="font-mono text-[10px] opacity-70">{new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function prettyAction(a: string): string {
  switch (a) {
    case "client.created": return "Client created";
    case "client.status_changed": return "Status changed";
    case "client.service_added": return "Service added";
    case "client.key_date_added": return "Key date added";
    case "document.uploaded": return "Document uploaded";
    case "document.viewed": return "Document viewed";
    case "note.added": return "Note added";
    case "booking.created": return "Consultation booked";
    case "submission.approved": return "Submission approved";
    case "submission.submitted": return "Application submitted";
    default: return a;
  }
}
