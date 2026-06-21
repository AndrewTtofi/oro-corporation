"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReassignModal({ clientId, currentPrimaryId, staff }: {
  clientId: string;
  currentPrimaryId: string;
  staff: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [pick, setPick] = useState(currentPrimaryId);
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryStaffId: pick }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">Reassign primary staff</button>;

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-head">
          <h3>Reassign primary staff</h3>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Primary staff</label>
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="select">
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <p className="muted" style={{ fontSize: "0.75rem", marginBottom: 0 }}>To change assigned partners per service, edit them inline in the Services Engaged section.</p>
        </div>
        <div className="modal-foot">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button>
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
