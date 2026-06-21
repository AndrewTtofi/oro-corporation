"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface EditRequestModalProps {
  id: string;
  description: string;
  dueAt: string | null;
  onClose: () => void;
}

export function EditRequestModal({ id, description, dueAt, onClose }: EditRequestModalProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [desc, setDesc] = useState(description);
  const [due, setDue] = useState(dueAt ? new Date(dueAt).toISOString().slice(0, 10) : "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (desc.trim().length < 3) { setError("Description must be at least 3 characters."); return; }
    setError(null);
    start(async () => {
      const res = await fetch(`/api/admin/document-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc.trim(),
          dueAt: due || null,
        }),
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Save failed");
      }
    });
  }

  return (
    <div
      className="scrim"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3>Edit document request</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="textarea"
              placeholder="What should the client upload?"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Due date (optional)</label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="input"
            />
          </div>
          {error && <p className="note" style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn btn-primary"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
