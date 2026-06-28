"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Plain props only — this is a client component, so it must not import from
// server modules (e.g. branding.ts pulls in the Prisma/pg adapter). The tier
// label is computed server-side and passed in as `minTierLabel`.
type SectionState = {
  key: string;
  label: string;
  description: string;
  minTierLabel: string;
  enabled: boolean;
  locked: boolean;
};

export function SectionsTable({ initial }: { initial: SectionState[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(key: string, enabled: boolean) {
    setBusyKey(key);
    setMsg(null);
    // Optimistic update.
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, enabled } : r)));
    start(async () => {
      const res = await fetch("/api/admin/client-dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(j.error ?? "Could not save.");
        // Roll back.
        setRows((rs) => rs.map((r) => (r.key === key ? { ...r, enabled: !enabled } : r)));
      } else {
        router.refresh();
      }
      setBusyKey(null);
    });
  }

  return (
    <div className="bg-admin-surface border border-admin-border rounded-elem overflow-hidden max-w-[760px]">
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="flex items-center gap-4 p-4"
          style={i ? { borderTop: "1px solid var(--border)" } : undefined}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-meta">{r.label}</span>
              {r.locked && (
                <span className="badge badge-pending">Requires {r.minTierLabel}</span>
              )}
            </div>
            <p className="text-admin-muted text-[12px] mt-0.5">{r.description}</p>
          </div>
          <Switch
            on={r.enabled && !r.locked}
            disabled={r.locked || (pending && busyKey === r.key)}
            onChange={(v) => toggle(r.key, v)}
          />
        </div>
      ))}
      {msg && <p className="text-meta text-[#DC2626] p-4 pt-0">{msg}</p>}
    </div>
  );
}

function Switch({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        width: 42,
        height: 24,
        background: on ? "var(--brand)" : "var(--border-strong)",
      }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all"
        style={{ width: 20, height: 20, left: on ? 20 : 2 }}
      />
    </button>
  );
}
