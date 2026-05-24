"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddPartyModal({ complianceFileId }: { complianceFileId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    start(async () => {
      const res = await fetch(`/api/admin/compliance/files/${complianceFileId}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: fd.get("type"),
          role: fd.get("role"),
          fullName: fd.get("fullName"),
          dateOfBirth: fd.get("dateOfBirth") || null,
          nationality: (fd.get("nationality") || null) as string | null,
          ownershipPct: fd.get("ownershipPct") ? Number(fd.get("ownershipPct")) : null,
        }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-primary px-4 py-2">+ Add party</button>;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
    >
      <div className="bg-admin-surface p-6 rounded-card w-[480px] max-w-[90vw] flex flex-col gap-3">
        <h3 className="font-display text-xl">Add party</h3>
        <select name="type" defaultValue="individual" className="input"><option value="individual">Individual</option><option value="entity">Entity</option></select>
        <select name="role" defaultValue="ubo" className="input">
          <option value="ubo">UBO</option><option value="director">Director</option>
          <option value="shareholder">Shareholder</option><option value="signatory">Signatory</option><option value="intermediary">Intermediary</option>
        </select>
        <input name="fullName" required placeholder="Full legal name" className="input" />
        <input name="dateOfBirth" type="date" className="input" />
        <input name="nationality" maxLength={2} placeholder="Nationality (e.g. CY)" className="input" />
        <input name="ownershipPct" type="number" step="0.01" placeholder="Ownership %" className="input" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setOpen(false)} className="btn px-4 py-2">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary px-4 py-2">Add</button>
        </div>
      </div>
    </form>
  );
}
