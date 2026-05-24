"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function HitRow({ hit }: { hit: { id: string; matchedName: string; matchedTopics: string[]; matchScore: number; reviewStatus: string; matchUrl: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  function review(next: "false_positive" | "confirmed_match" | "escalated") {
    if ((next === "confirmed_match" || next === "escalated") && !note) {
      alert("A note is required to confirm or escalate a hit.");
      return;
    }
    start(async () => {
      const res = await fetch(`/api/admin/compliance/hits/${hit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: next, note: note || null }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }
  return (
    <li className="border border-admin-border rounded-elem p-3 flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <div>
          <div className="font-semibold text-meta">{hit.matchedName}</div>
          <div className="text-[11px] text-admin-muted">topics: {hit.matchedTopics.join(", ") || "—"} · score {hit.matchScore.toFixed(2)} · {hit.reviewStatus}</div>
        </div>
        {hit.matchUrl && <a href={hit.matchUrl} target="_blank" rel="noreferrer" className="text-[12px] underline">Open on OpenSanctions</a>}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note" className="input" />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => review("false_positive")} className="btn px-3 py-1.5 text-[12px]">False positive</button>
        <button type="button" disabled={pending} onClick={() => review("confirmed_match")} className="btn px-3 py-1.5 text-[12px] text-[#DC2626]">Confirm match</button>
        <button type="button" disabled={pending} onClick={() => review("escalated")} className="btn px-3 py-1.5 text-[12px]">Escalate</button>
      </div>
    </li>
  );
}
