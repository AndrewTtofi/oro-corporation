"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PartnerNoteForm({ clientId }: { clientId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, body }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setError(b.error ?? "Could not save note");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an internal note…"
        className="w-full min-h-[80px] px-3 py-2 text-[13px] rounded-inner"
        style={{ border: "1px solid var(--border)" }}
      />
      {error && <div className="text-meta mt-2" style={{ color: "#DC2626" }}>{error}</div>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !body.trim()}
        className="mt-3 px-4 py-2 rounded-inner font-semibold text-meta disabled:opacity-50"
        style={{ background: "var(--dark)", color: "var(--accent)" }}
      >
        Save note
      </button>
    </div>
  );
}
