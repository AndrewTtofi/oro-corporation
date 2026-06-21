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
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Send failed");
      }
    });
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="card">
      <div className="row-between mb-3">
        <div className="eyebrow">Compose</div>
        <span className="badge badge-info">Visible to client</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKey}
        placeholder="Address the client. Be precise."
        rows={4}
        className="textarea"
      />
      <hr className="hairline my-3" />
      <div className="row-between">
        <span className="muted mono" style={{ fontSize: "var(--fs-2xs)" }}>
          ⌘ + Enter to send
        </span>
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className="btn btn-primary"
        >
          {pending ? "Sending…" : "Send →"}
        </button>
      </div>
    </div>
  );
}
