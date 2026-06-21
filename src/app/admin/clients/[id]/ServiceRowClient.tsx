"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServiceRow } from "./ServicesEngagedList";

export function ServiceRowClient({ row, partners, taxonomy }: {
  row: ServiceRow;
  partners: { id: string; fullName: string }[];
  taxonomy: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(row);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row);
  const label = taxonomy.find((t) => t.key === row.serviceType)?.label ?? row.serviceType;

  function save() {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${row.clientId}/services/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          assignedPartnerId: draft.assignedPartnerId,
          startDate: draft.startDate,
          notes: draft.notes,
        }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Save failed"); }
    });
  }
  function remove() {
    if (!confirm(`Remove ${label} from this client?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/clients/${row.clientId}/services/${row.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="border border-admin-border rounded-elem p-4 mb-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-semibold">{label}</div>
        <div className="flex gap-2 shrink-0">
          {dirty && <button type="button" onClick={save} disabled={pending} className="btn btn-primary px-3 py-1.5 text-meta">Save</button>}
          <button type="button" onClick={remove} disabled={pending} className="btn px-3 py-1.5 text-meta text-[#DC2626]">Remove</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Status</span>
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ServiceRow["status"] })} className="input">
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Partner</span>
          <select value={draft.assignedPartnerId ?? ""} onChange={(e) => setDraft({ ...draft, assignedPartnerId: e.target.value || null })} className="input">
            <option value="">Unassigned</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-admin-muted">Notes</span>
          <input value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} placeholder="Add a note…" className="input w-full" />
        </label>
      </div>
    </div>
  );
}
