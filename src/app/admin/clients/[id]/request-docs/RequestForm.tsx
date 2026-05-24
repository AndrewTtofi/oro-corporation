"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RequestForm({ clientId, taxonomy }: { clientId: string; taxonomy: { key: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: fd.get("description"),
          serviceTypeKey: fd.get("serviceTypeKey") || null,
          dueAt: fd.get("dueAt") || null,
        }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; submit(new FormData(f)); f.reset(); }}
      className="bg-admin-surface border border-admin-border rounded-card p-4 flex flex-col gap-3"
    >
      <input name="description" required placeholder="What document do you need? (e.g. Latest bank statement)" className="input" />
      <div className="grid gap-3 md:grid-cols-2">
        <select name="serviceTypeKey" defaultValue="" className="input">
          <option value="">No service (general)</option>
          {taxonomy.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input name="dueAt" type="date" className="input" />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary px-4 py-2">{pending ? "Sending…" : "Send request"}</button>
      </div>
    </form>
  );
}
