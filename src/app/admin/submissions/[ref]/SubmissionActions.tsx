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
    <div className="flex flex-col gap-6">
      <section className="bg-admin-surface border border-admin-border rounded-elem p-6">
        <div className="text-meta font-bold mb-3">Quick actions</div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => updateStatus("approved")}
            disabled={pending || status === "approved"}
            className="w-full py-3 rounded-inner font-semibold disabled:opacity-50 text-white"
            style={{ background: "#059669" }}
          >
            Approve Submission
          </button>
          <button
            type="button"
            onClick={() => setShowInfoModal(true)}
            disabled={pending}
            className="w-full py-3 rounded-inner font-semibold text-white"
            style={{ background: "#2563EB" }}
          >
            Request More Info
          </button>
          <button
            type="button"
            onClick={() => updateStatus("rejected")}
            disabled={pending || status === "rejected"}
            className="w-full py-3 rounded-inner font-semibold disabled:opacity-50 text-white"
            style={{ background: "#DC2626" }}
          >
            Reject
          </button>
        </div>
        {error && <div className="text-meta mt-3" style={{ color: "#DC2626" }}>{error}</div>}
      </section>

      <section className="bg-admin-surface border border-admin-border rounded-elem p-6">
        <div className="text-meta font-bold mb-3">Status</div>
        <select
          value={status}
          onChange={(e) => void updateStatus(e.target.value as ProspectStatus)}
          className="w-full px-3 py-2.5 rounded-inner text-meta"
          style={{ border: "1px solid var(--border)" }}
        >
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="needs_info">Needs More Info</option>
          <option value="rejected">Rejected</option>
        </select>

        <div className="text-meta font-bold mt-6 mb-3">Assigned Partner</div>
        <select
          value={partnerId ?? ""}
          onChange={(e) => void reassignPartner(e.target.value || null)}
          className="w-full px-3 py-2.5 rounded-inner text-meta"
          style={{ border: "1px solid var(--border)" }}
        >
          <option value="">Unassigned</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
      </section>

      <section className="bg-admin-surface border border-admin-border rounded-elem p-6">
        <div className="text-meta font-bold mb-1">Brief completeness</div>
        <p className="text-[11px] text-admin-muted mb-3">
          Auto score: <strong>{({ low: "Low", med: "Medium", high: "High" } as const)[autoCompleteness]}</strong>. Override to reprioritise prep.
        </p>
        <div className="flex gap-2">
          {(["low", "med", "high"] as const).map((c) => {
            const active = (override ?? autoCompleteness) === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => void setCompleteness(c)}
                className="flex-1 py-2 rounded-inner text-meta font-medium"
                style={{ border: "1px solid var(--border-strong-color)", background: active ? "var(--brand)" : "var(--surface)", color: active ? "#fff" : "var(--text-muted)" }}
              >
                {c === "low" ? "Low" : c === "med" ? "Medium" : "High"}
              </button>
            );
          })}
        </div>
        {override && (
          <button type="button" onClick={() => void setCompleteness(null)} className="mt-3 text-[11px] text-admin-muted underline">
            Clear override (use auto score)
          </button>
        )}
      </section>

      <section className="bg-admin-surface border border-admin-border rounded-elem p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-meta font-bold">Internal Notes</div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          className="w-full min-h-[80px] px-3 py-2 text-[13px] rounded-inner mb-3"
          style={{ border: "1px solid var(--border)" }}
        />
        <button
          type="button"
          onClick={postNote}
          disabled={pending || !note.trim()}
          className="w-full py-2 rounded-inner font-semibold disabled:opacity-50"
          style={{ background: "var(--dark)", color: "var(--accent)" }}
        >
          Save note
        </button>
        <ul className="mt-5 flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-inner p-3 text-[13px]" style={{ background: "var(--bg)" }}>
              <p className="leading-relaxed">{n.body}</p>
              <div className="flex justify-between text-[11px] text-admin-muted mt-2">
                <span>{n.author}</span>
                <span className="font-mono">{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-admin-surface border border-admin-border rounded-elem p-6">
        <div className="text-[12px] font-bold uppercase tracking-widest text-admin-muted mb-3">Activity log</div>
        <ul className="flex flex-col gap-3">
          {activity.map((a) => (
            <li key={a.id} className="flex gap-3 text-[12px]">
              <span className="font-mono text-admin-muted whitespace-nowrap shrink-0 opacity-70">
                {new Date(a.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span className="text-admin-fg">{prettyAction(a.action)} <span className="text-admin-muted">— {a.actor}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {showInfoModal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-admin-surface rounded-card w-full max-w-[520px] overflow-hidden">
            <div className="px-6 py-5 border-b border-admin-border flex justify-between items-center">
              <h3 className="font-display text-xl">Request more information</h3>
              <button type="button" onClick={() => setShowInfoModal(false)} className="text-admin-muted">✕</button>
            </div>
            <div className="p-6 max-h-[440px] overflow-y-auto flex flex-col gap-3">
              <p className="text-meta text-admin-muted mb-2">Pick from the checklist or add a custom message — both are sent to the applicant.</p>
              {INFO_CHECKLIST.map((label) => (
                <label key={label} className="flex items-start gap-3 text-meta cursor-pointer">
                  <input
                    type="checkbox"
                    checked={infoChecked.has(label)}
                    onChange={(e) => {
                      const next = new Set(infoChecked);
                      if (e.target.checked) next.add(label); else next.delete(label);
                      setInfoChecked(next);
                    }}
                    className="mt-1"
                  />
                  {label}
                </label>
              ))}
              <textarea
                value={infoCustom}
                onChange={(e) => setInfoCustom(e.target.value)}
                placeholder="Custom message (optional)"
                className="mt-3 min-h-[80px] px-3 py-2 text-[13px] rounded-inner"
                style={{ border: "1px solid var(--border)" }}
              />
            </div>
            <div className="px-6 py-4 border-t border-admin-border flex justify-end gap-3" style={{ background: "var(--bg)" }}>
              <button type="button" onClick={() => setShowInfoModal(false)} className="btn btn-ghost px-5 py-2.5">Cancel</button>
              <button
                type="button"
                onClick={requestInfo}
                disabled={pending || (infoChecked.size === 0 && !infoCustom.trim())}
                className="px-5 py-2.5 rounded-inner font-semibold text-white disabled:opacity-50"
                style={{ background: "#2563EB" }}
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
