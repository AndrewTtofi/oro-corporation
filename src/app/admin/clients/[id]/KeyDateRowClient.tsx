"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KeyDate } from "./KeyDatesSection";

export function KeyDateRowClient({ kd }: { kd: KeyDate }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ description: kd.description, dueDate: kd.dueDate.slice(0, 10) });

  function patch(body: Record<string, unknown>) {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${kd.clientId}/key-dates/${kd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setEditing(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }
  function remove() {
    if (!confirm(`Delete "${kd.description}"?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/clients/${kd.clientId}/key-dates/${kd.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  const upcoming = kd.status === "upcoming";
  const overdue = kd.status === "overdue";
  const done = kd.status === "completed";

  return (
    <div className="flex gap-4 items-start">
      <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: overdue ? "#DC2626" : upcoming ? "var(--accent)" : "var(--border)" }} />
      <div className="flex-1">
        {editing ? (
          <div className="grid gap-2 grid-cols-[1fr_auto_auto]">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input" />
            <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} className="input" />
            <button type="button" onClick={() => patch({ description: draft.description, dueDate: draft.dueDate })} disabled={pending} className="btn btn-primary px-3 py-1.5 text-meta">Save</button>
          </div>
        ) : (
          <>
            <div className="font-mono text-[12px] text-accent font-semibold">
              {new Date(kd.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
            </div>
            <div className={`font-semibold ${overdue ? "text-[#DC2626]" : done ? "line-through opacity-60" : ""}`}>{kd.description}</div>
            <div className="text-[12px] text-admin-muted">{overdue ? "Overdue" : upcoming ? "Upcoming" : "Completed"}</div>
          </>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {!done && <button type="button" disabled={pending} onClick={() => patch({ status: "completed" })} className="text-[12px] underline">Mark done</button>}
        {!editing && <button type="button" disabled={pending} onClick={() => setEditing(true)} className="text-[12px] underline">Edit</button>}
        <button type="button" disabled={pending} onClick={remove} className="text-[12px] underline text-[#DC2626]">Delete</button>
      </div>
    </div>
  );
}
