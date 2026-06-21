"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProspectStatus } from "@prisma/client";

interface ProspectLite { id: string; status: ProspectStatus; referenceNumber: string }
interface Partner { id: string; fullName: string }
interface NoteRow { id: string; author: string; body: string; createdAt: string }
interface ActivityRow { id: string; action: string; actor: string; createdAt: string }

const INFO_CHECKLIST = [
  "Clearer passport scan (photo page, all corners visible)",
  "Proof of address dated within the last 3 months",
  "Source of funds documentation",
  "Updated company business plan",
  "Director's CV / résumé",
];

type Comp = "low" | "med" | "high";

export function SubmissionActions({
  prospect, partners, assignedPartnerId, initialNotes, activity, completenessOverride, autoCompleteness,
}: {
  prospect: ProspectLite;
  partners: Partner[];
  assignedPartnerId: string | null;
  initialNotes: NoteRow[];
  activity: ActivityRow[];
  completenessOverride: Comp | null;
  autoCompleteness: Comp;
}) {
  const [status, setStatus] = useState<ProspectStatus>(prospect.status);
  const [partnerId, setPartnerId] = useState<string | null>(assignedPartnerId);
  const [override, setOverride] = useState<Comp | null>(completenessOverride);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<NoteRow[]>(initialNotes);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoChecked, setInfoChecked] = useState<Set<string>>(new Set());
  const [infoCustom, setInfoCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function updateStatus(target: ProspectStatus, extraNote?: string) {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/admin/submissions/${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target, note: extraNote }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Update failed");
        return;
      }
      setStatus(target);
      router.refresh();
    });
  }

  async function setCompleteness(value: Comp | null) {
    setOverride(value);
    await fetch(`/api/admin/submissions/${prospect.id}/completeness`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completeness: value }),
    });
    router.refresh();
  }

  async function reassignPartner(id: string | null) {
    setPartnerId(id);
    await fetch(`/api/admin/submissions/${prospect.id}/assign-partner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: id }),
    });
  }

  async function postNote() {
    if (!note.trim()) return;
    start(async () => {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, body: note }),
      });
      if (!res.ok) { setError("Could not save note"); return; }
      setNotes((n) => [{ id: crypto.randomUUID(), author: "You", body: note, createdAt: new Date().toISOString() }, ...n]);
      setNote("");
    });
  }

  async function requestInfo() {
    const picked = Array.from(infoChecked);
    const body = [
      picked.length ? `We need the following:\n- ${picked.join("\n- ")}` : "",
      infoCustom.trim() ? `Additional notes:\n${infoCustom.trim()}` : "",
    ].filter(Boolean).join("\n\n");
    await updateStatus("needs_info", body);
    setShowInfoModal(false);
    setInfoChecked(new Set());
    setInfoCustom("");
  }

  return (
    <div>
      <section className="card mb-4">
        <h3 className="card-title">Quick actions</h3>
        <div className="row gap-3" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <button
            type="button"
            onClick={() => updateStatus("approved")}
            disabled={pending || status === "approved"}
            className="btn btn-primary btn-block"
          >
            Approve Submission
          </button>
          <button
            type="button"
            onClick={() => setShowInfoModal(true)}
            disabled={pending}
            className="btn btn-secondary btn-block"
          >
            Request More Info
          </button>
          <button
            type="button"
            onClick={() => updateStatus("rejected")}
            disabled={pending || status === "rejected"}
            className="btn btn-danger btn-block"
          >
            Reject
          </button>
        </div>
        {error && <p className="help mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
      </section>

      <section className="card mb-4">
        <div className="field">
          <label>Status</label>
          <select
            value={status}
            onChange={(e) => void updateStatus(e.target.value as ProspectStatus)}
            className="select"
          >
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="needs_info">Needs More Info</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>Assigned Partner</label>
          <select
            value={partnerId ?? ""}
            onChange={(e) => void reassignPartner(e.target.value || null)}
            className="select"
          >
            <option value="">Unassigned</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
      </section>

      <section className="card mb-4">
        <h3 className="card-title">Brief completeness</h3>
        <p className="muted mb-3" style={{ fontSize: "var(--fs-xs)" }}>
          Auto score: <strong>{({ low: "Low", med: "Medium", high: "High" } as const)[autoCompleteness]}</strong>. Override to reprioritise prep.
        </p>
        <div className="toggle-group">
          {(["low", "med", "high"] as const).map((c) => {
            const active = (override ?? autoCompleteness) === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => void setCompleteness(c)}
                className={active ? "active" : ""}
              >
                {c === "low" ? "Low" : c === "med" ? "Medium" : "High"}
              </button>
            );
          })}
        </div>
        {override && (
          <button type="button" onClick={() => void setCompleteness(null)} className="btn btn-ghost btn-sm mt-3">
            Clear override (use auto score)
          </button>
        )}
      </section>

      <section className="card mb-4">
        <h3 className="card-title">Internal Notes</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          className="textarea mb-3"
        />
        <button
          type="button"
          onClick={postNote}
          disabled={pending || !note.trim()}
          className="btn btn-secondary btn-block"
        >
          Save note
        </button>
        <ul className="mt-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notes.map((n) => (
            <li key={n.id} className="note">
              <div>
                <p style={{ lineHeight: 1.5 }}>{n.body}</p>
                <div className="row-between muted mt-2" style={{ fontSize: "var(--fs-xs)" }}>
                  <span>{n.author}</span>
                  <span className="mono">{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="card-title">Activity log</h3>
        <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activity.map((a) => (
            <li key={a.id} className="row gap-3" style={{ fontSize: "var(--fs-xs)", alignItems: "flex-start" }}>
              <span className="mono muted" style={{ whiteSpace: "nowrap", flex: "none" }}>
                {new Date(a.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span>{prettyAction(a.action)} <span className="muted">— {a.actor}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {showInfoModal && (
        <div className="scrim">
          <div className="modal">
            <div className="modal-head">
              <h3>Request more information</h3>
              <button type="button" onClick={() => setShowInfoModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div className="modal-body">
              <p className="muted mb-4" style={{ fontSize: "var(--fs-sm)" }}>Pick from the checklist or add a custom message — both are sent to the applicant.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {INFO_CHECKLIST.map((label) => (
                  <label key={label} className="row gap-3" style={{ alignItems: "flex-start", fontSize: "var(--fs-sm)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={infoChecked.has(label)}
                      onChange={(e) => {
                        const next = new Set(infoChecked);
                        if (e.target.checked) next.add(label); else next.delete(label);
                        setInfoChecked(next);
                      }}
                      style={{ marginTop: 3 }}
                    />
                    {label}
                  </label>
                ))}
                <textarea
                  value={infoCustom}
                  onChange={(e) => setInfoCustom(e.target.value)}
                  placeholder="Custom message (optional)"
                  className="textarea mt-2"
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" onClick={() => setShowInfoModal(false)} className="btn btn-ghost">Cancel</button>
              <button
                type="button"
                onClick={requestInfo}
                disabled={pending || (infoChecked.size === 0 && !infoCustom.trim())}
                className="btn btn-secondary"
              >
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function prettyAction(a: string): string {
  switch (a) {
    case "submission.submitted":    return "Application submitted";
    case "submission.created":      return "Application created";
    case "submission.draft_saved":  return "Draft saved";
    case "submission.approved":     return "Approved";
    case "submission.rejected":     return "Rejected";
    case "submission.info_requested": return "More info requested";
    case "submission.status_changed": return "Status changed";
    case "document.uploaded":       return "Document uploaded";
    case "document.viewed":         return "Document viewed";
    case "note.added":              return "Note added";
    case "client.created":          return "Client created";
    default:                        return a;
  }
}
