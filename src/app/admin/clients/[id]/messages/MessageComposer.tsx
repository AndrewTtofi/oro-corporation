"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MessageComposer({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  function send() {
    if (!body.trim()) return;
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) { setBody(""); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Send failed"); }
    });
  }

  return (
    <div className="bg-admin-surface border border-admin-border rounded-card p-4">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" rows={4} className="input w-full" />
      <div className="flex justify-end mt-3">
        <button type="button" onClick={send} disabled={pending || !body.trim()} className="btn btn-primary px-4 py-2 disabled:opacity-50">
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
