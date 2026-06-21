"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddServiceModal({ clientId, taxonomy, partners }: {
  clientId: string;
  taxonomy: { key: string; label: string }[];
  partners: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: fd.get("serviceType"),
          assignedPartnerId: fd.get("assignedPartnerId") || null,
          startDate: fd.get("startDate") || null,
          notes: fd.get("notes") || null,
        }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm">+ Add service</button>;

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
        className="modal"
        style={{ maxWidth: 480 }}
      >
        <div className="modal-head">
          <h3>Add service</h3>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Service type</label>
            <select name="serviceType" required className="select">
              {taxonomy.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Assigned partner</label>
            <select name="assignedPartnerId" defaultValue="" className="select">
              <option value="">Unassigned</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Start date</label>
            <input name="startDate" type="date" className="input" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Notes</label>
            <textarea name="notes" rows={2} placeholder="Notes (optional)" className="textarea" />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">Add</button>
        </div>
      </form>
    </div>
  );
}
