"use client";
import { useState } from "react";
import { KeyDateRowClient } from "./KeyDateRowClient";

export type KeyDate = {
  id: string;
  clientId: string;
  description: string;
  dueDate: string; // ISO
  status: "upcoming" | "overdue" | "completed";
};

export function KeyDatesSection({ clientId, rows }: { clientId: string; rows: KeyDate[] }) {
  const [hideCompleted, setHideCompleted] = useState(true);
  const visible = hideCompleted ? rows.filter((r) => r.status !== "completed") : rows;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted">Key Dates &amp; Reminders</h2>
        <label className="flex items-center gap-2 text-meta">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} /> Hide completed
        </label>
      </div>
      <div className="bg-admin-surface border border-admin-border rounded-card p-6">
        <div className="flex flex-col gap-4">
          {visible.length === 0 && <p className="text-meta text-admin-muted">No key dates.</p>}
          {visible.map((kd) => <KeyDateRowClient key={kd.id} kd={kd} />)}
        </div>
        <form
          action={`/api/admin/clients/${clientId}/key-dates`}
          method="POST"
          className="mt-6 grid gap-2 grid-cols-[1fr_auto_auto]"
        >
          <input name="description" placeholder="Description (e.g. Annual return)" className="input" required />
          <input name="dueDate" type="date" className="input" required />
          <button type="submit" className="btn btn-primary px-4 py-2 text-meta">+ Add</button>
        </form>
      </div>
    </section>
  );
}
