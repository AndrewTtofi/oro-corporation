"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ITEMS = [
  "Face matches photo on doc",
  "Document not expired",
  "Name matches party record",
  "DOB matches party record",
  "Document appears authentic (no obvious tampering)",
  "Proof of address is recent (< 3 months)",
  "Address on POA matches party record",
];

export function IdvChecklist({ partyId, kycCaseStatus }: { partyId: string; kycCaseStatus: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ticks, setTicks] = useState<boolean[]>(ITEMS.map(() => false));
  const [note, setNote] = useState("");

  function patch(status: "verified" | "failed") {
    if (status === "failed" && !note) { alert("A reason is required to mark as failed."); return; }
    start(async () => {
      const res = await fetch(`/api/admin/compliance/parties/${partyId}/kyc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idvStatus: status, idvNote: note || null }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-4">
      <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Identity verification</h3>
      <div className="text-meta mb-3">Current: <span className="badge badge-pending capitalize">{kycCaseStatus}</span></div>
      <ul className="flex flex-col gap-2 mb-3">
        {ITEMS.map((it, i) => (
          <li key={it}>
            <label className="flex gap-2 items-center text-meta">
              <input type="checkbox" checked={ticks[i]} onChange={(e) => { const c = [...ticks]; c[i] = e.target.checked; setTicks(c); }} /> {it}
            </label>
          </li>
        ))}
      </ul>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes (required for failure)" className="input w-full" rows={2} />
      <div className="flex gap-2 mt-3">
        <button type="button" disabled={pending || !ticks.every(Boolean)} onClick={() => patch("verified")} className="btn btn-primary px-4 py-2 disabled:opacity-50">Mark verified</button>
        <button type="button" disabled={pending} onClick={() => patch("failed")} className="btn px-4 py-2 text-[#DC2626]">Mark failed</button>
      </div>
    </section>
  );
}
