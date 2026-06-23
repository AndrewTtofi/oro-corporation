import { FulfillButton } from "./FulfillButton";

export type ReqRow = { id: string; description: string; serviceTypeKey: string | null; dueAt: Date | null };

export function RequestsBlock({ requests, brandName }: { requests: ReqRow[]; brandName: string }) {
  if (requests.length === 0) return null;
  return (
    <section className="bg-[var(--client-surface)] border border-token rounded-card p-6 mb-6">
      <h2 className="text-meta font-bold uppercase tracking-widest text-muted mb-3">Requested by {brandName}</h2>
      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="flex justify-between items-center">
            <div>
              <div className="text-meta font-semibold">{r.description}</div>
              {r.dueAt && <div className="text-[11px] text-muted font-mono">due {new Date(r.dueAt).toLocaleDateString()}</div>}
            </div>
            <FulfillButton requestId={r.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
