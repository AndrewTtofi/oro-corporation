"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { HitRow } from "./HitRow";

export function ScreeningPanel({ partyId, latest }: {
  partyId: string;
  latest: null | { id: string; outcome: string; ranAt: string; hits: { id: string; matchedName: string; matchedTopics: string[]; matchScore: number; reviewStatus: string; matchUrl: string | null }[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    start(async () => {
      await fetch(`/api/admin/compliance/parties/${partyId}/screen`, { method: "POST" });
      router.refresh();
    });
  }
  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted">Screening</h3>
        <button type="button" onClick={run} disabled={pending} className="btn px-3 py-1.5 text-meta">Run screening</button>
      </div>
      {!latest ? <p className="text-meta text-admin-muted">No screening yet.</p> : (
        <>
          <p className="text-meta mb-2">Latest: <span className="badge badge-pending">{latest.outcome}</span> at {new Date(latest.ranAt).toLocaleString()}</p>
          {latest.hits.length === 0 ? <p className="text-meta text-admin-muted">No hits.</p> : (
            <ul className="flex flex-col gap-2">{latest.hits.map((h) => <HitRow key={h.id} hit={h} />)}</ul>
          )}
        </>
      )}
    </section>
  );
}
