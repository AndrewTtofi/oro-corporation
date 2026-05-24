"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function RiskPanel({ fileId, computed, computedScore, rating, overrideReason }: {
  fileId: string;
  computed: string | null;
  computedScore: number | null;
  rating: string | null;
  overrideReason: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [next, setNext] = useState<string>(rating ?? computed ?? "standard");
  const [reason, setReason] = useState<string>(overrideReason ?? "");

  function recompute() {
    start(async () => {
      await fetch(`/api/admin/compliance/files/${fileId}/recompute-risk`, { method: "POST" });
      router.refresh();
    });
  }
  function confirmOverride() {
    start(async () => {
      await fetch(`/api/admin/compliance/files/${fileId}/risk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: next, reason: reason || "Confirmed computed rating" }),
      });
      router.refresh();
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-meta font-bold uppercase tracking-widest text-admin-muted">Risk</div>
          <div className="flex gap-2 items-baseline mt-1">
            <span className="badge badge-approved capitalize">{rating ?? "not set"}</span>
            <span className="text-meta text-admin-muted">computed: {computed ?? "—"} ({computedScore ?? "—"})</span>
          </div>
        </div>
        <button type="button" onClick={recompute} disabled={pending} className="btn px-3 py-1.5 text-meta">Re-compute</button>
      </div>
      <div className="mt-4 flex gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Override rating</span>
          <select value={next} onChange={(e) => setNext(e.target.value)} className="input">
            <option value="low">low</option>
            <option value="standard">standard</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Why override?" />
        </label>
        <button type="button" onClick={confirmOverride} disabled={pending} className="btn btn-primary px-4 py-2">Save</button>
      </div>
    </section>
  );
}
