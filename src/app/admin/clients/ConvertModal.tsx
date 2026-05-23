"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Candidate { prospectId: string; referenceNumber: string; name: string; services: string[] }

export function ConvertModal({ candidates }: { candidates: Candidate[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function convert(prospectId: string) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/admin/clients/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Convert failed");
        return;
      }
      const out = (await res.json()) as { clientId: string };
      router.push(`/admin/clients/${out.clientId}`);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary px-6 py-2.5 gap-2">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6"/>
        </svg>
        Convert from Prospect
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-admin-surface rounded-card w-full max-w-[600px] overflow-hidden">
            <div className="px-6 py-5 border-b border-admin-border flex justify-between items-center">
              <h3 className="font-display text-xl">Convert from Prospect</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-admin-muted">✕</button>
            </div>
            <div className="p-6 max-h-[440px] overflow-y-auto">
              <p className="text-meta text-admin-muted mb-5">
                The following approved prospects are ready to be converted to active clients.
              </p>
              {candidates.length === 0 ? (
                <p className="text-meta text-admin-muted">No approved prospects waiting.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {candidates.map((c) => (
                    <li key={c.prospectId} className="flex items-center justify-between gap-3 p-3 rounded-inner border border-admin-border">
                      <div>
                        <div className="text-meta font-semibold">{c.name}</div>
                        <div className="text-[12px] text-admin-muted">
                          Ref: <span className="font-mono">{c.referenceNumber}</span> · {c.services.map(pretty).join(", ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => convert(c.prospectId)}
                        disabled={pending}
                        className="btn btn-primary px-3 py-1.5 text-[12px] disabled:opacity-50"
                      >
                        Make Client
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <div className="text-meta mt-4" style={{ color: "#DC2626" }}>{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-admin-border flex justify-end" style={{ background: "#F9FAFB" }}>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost px-5 py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function pretty(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
