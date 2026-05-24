"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface NoteRow { id: string; author: string; body: string; createdAt: string }

export function ClientNotes({ clientId, initial }: { clientId: string; initial: NoteRow[] }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState<NoteRow[]>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function save() {
    if (!body.trim()) return;
    start(async () => {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, body }),
      });
      if (res.ok) {
        setNotes((n) => [{ id: crypto.randomUUID(), author: "You", body, createdAt: new Date().toISOString() }, ...n]);
        setBody("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card">
      <div className="px-6 py-4 border-b border-admin-border flex justify-between items-center" style={{ background: "#FDFDFD" }}>
        <h3 className="font-bold text-base">Internal Notes</h3>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-meta font-bold text-accent">
          {open ? "Cancel" : "Add Note"}
        </button>
      </div>

      {open && (
        <div className="p-6 border-b border-admin-border">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you learn? Plans, concerns, follow-ups…"
            className="w-full min-h-[80px] px-3 py-2 text-[13px] rounded-inner"
            style={{ border: "1px solid var(--border)" }}
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || !body.trim()}
            className="mt-3 px-4 py-2 rounded-inner font-semibold text-meta disabled:opacity-50"
            style={{ background: "var(--dark)", color: "var(--accent)" }}
          >
            Save note
          </button>
        </div>
      )}

      <div className="p-6 pt-3 flex flex-col gap-4">
        {notes.length === 0 ? (
          <p className="text-meta text-admin-muted">No notes yet.</p>
        ) : notes.map((n) => (
          <div key={n.id} className="rounded-elem p-3 text-[13px] leading-relaxed" style={{ background: "var(--bg)" }}>
            {n.body}
            <div className="flex justify-between text-[11px] text-admin-muted mt-2">
              <span>{n.author}</span>
              <span className="font-mono">{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
