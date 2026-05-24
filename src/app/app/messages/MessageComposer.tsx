"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MessageComposer({ prospectId }: { prospectId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSend() {
    if (!body.trim()) return;
    start(async () => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, body }),
      });
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-3 items-end">
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Type a message…"
        className="textarea flex-1"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSend();
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={pending || !body.trim()}
        className="btn btn-primary px-5 py-3 disabled:opacity-40"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
