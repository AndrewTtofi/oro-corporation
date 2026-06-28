"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function OrgForm({
  initial,
}: {
  initial: {
    displayName: string;
    contactEmail: string | null;
    address: string | null;
    documentsPhase: "mandatory" | "optional" | "off";
  };
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await fetch("/api/admin/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: fd.get("displayName"),
          contactEmail: fd.get("contactEmail"),
          address: fd.get("address"),
          documentsPhase: fd.get("documentsPhase"),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? "Saved." : (body.error ?? "Failed to save."));
      if (res.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl flex flex-col gap-5">
      <Field label="Organization name">
        <input name="displayName" required defaultValue={initial.displayName} className="input" />
      </Field>
      <Field label="Contact email">
        <input name="contactEmail" type="email" defaultValue={initial.contactEmail ?? ""} className="input" placeholder="hello@oro.local" />
      </Field>
      <Field label="Address">
        <textarea name="address" rows={3} defaultValue={initial.address ?? ""} className="input" placeholder="Street, City, Country" />
      </Field>
      <Field label="Onboarding documents step">
        <select name="documentsPhase" defaultValue={initial.documentsPhase} className="select">
          <option value="mandatory">Mandatory — passport &amp; proof of address required to submit</option>
          <option value="optional">Optional — step shown, applicants can submit without documents</option>
          <option value="off">Off — remove the documents step (2-step onboarding)</option>
        </select>
        <p className="text-meta text-admin-muted">Controls the third onboarding phase where clients upload identity documents.</p>
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary px-5 py-2.5 disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-meta text-admin-muted">{msg}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-meta font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
