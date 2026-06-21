"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  prospectId: string;
  referenceNumber: string;
  name: string;
  services: string[];
  compliance: "open" | "in_review" | "cleared" | "blocked";
}

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
        if (res.status === 409) {
          const msg =
            body.error === "compliance_blocked"
              ? "Conversion blocked: compliance file is blocked. Resolve it before converting."
              : body.error === "compliance_not_cleared"
              ? "Conversion blocked: compliance review is not yet cleared."
              : body.error === "no_compliance_file"
              ? "Conversion blocked: no compliance file found for this prospect."
              : body.error ?? "Conversion blocked by compliance gate.";
          setError(msg);
        } else {
          setError(body.error ?? "Convert failed");
        }
        return;
      }
      const out = (await res.json()) as { clientId: string };
      router.push(`/admin/clients/${out.clientId}`);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6"/>
        </svg>
        Convert from Prospect
      </button>

      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Convert from Prospect</h3>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div className="modal-body">
              <p className="muted mb-6" style={{ fontSize: "var(--fs-sm)" }}>
                The following approved prospects are ready to be converted to active clients.
              </p>
              {candidates.length === 0 ? (
                <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>No approved prospects waiting.</p>
              ) : (
                <ul className="row" style={{ flexDirection: "column", gap: ".75rem" }}>
                  {candidates.map((c) => (
                    <li key={c.prospectId} className="card row-between" style={{ gap: ".75rem", alignItems: "center" }}>
                      <div>
                        <div className="row" style={{ alignItems: "center", gap: ".5rem", fontWeight: 600 }}>
                          {c.name}
                          {c.compliance === "cleared" ? (
                            <span className="badge badge-approved">✓ Cleared</span>
                          ) : c.compliance === "blocked" ? (
                            <span className="badge badge-danger">✗ Blocked</span>
                          ) : (
                            <span className="badge badge-pending">⚠ In review</span>
                          )}
                        </div>
                        <div className="muted mt-1" style={{ fontSize: "var(--fs-xs)" }}>
                          Ref: <span className="mono">{c.referenceNumber}</span> · {c.services.map(pretty).join(", ")}
                        </div>
                      </div>
                      {c.compliance === "cleared" ? (
                        <button
                          type="button"
                          onClick={() => convert(c.prospectId)}
                          disabled={pending}
                          className="btn btn-primary btn-sm"
                        >
                          Make Client
                        </button>
                      ) : (
                        <a
                          href={`/admin/submissions/${c.referenceNumber}/compliance`}
                          className="btn btn-ghost btn-sm"
                        >
                          Open compliance →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {error && <div className="badge badge-danger mt-4">{error}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
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
