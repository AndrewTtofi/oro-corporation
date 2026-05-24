"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SignOffPanel({ fileId, status, riskRating, signedOffAt, signedOffNote, parties }: {
  fileId: string;
  status: string;
  riskRating: string | null;
  signedOffAt: string | null;
  signedOffNote: string | null;
  parties: { kycCase: { state: string; latestScreeningRun: null | { hits: { reviewStatus: string }[] } } | null; fullName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  const reasons: string[] = [];
  if (!riskRating) reasons.push("Risk rating not set");
  if (status === "blocked") reasons.push("File is blocked");
  for (const p of parties) {
    if (p.kycCase?.state !== "passed") reasons.push(`${p.fullName} not passed`);
    if (p.kycCase?.latestScreeningRun?.hits.some((h) => h.reviewStatus === "unreviewed")) reasons.push(`${p.fullName} has unreviewed hits`);
  }
  const canSignOff = reasons.length === 0 && status !== "cleared";

  function signOff() {
    start(async () => {
      const res = await fetch(`/api/admin/compliance/files/${fileId}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Sign-off failed"); }
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-6">
      <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Sign-off</h3>
      {status === "cleared" ? (
        <div className="text-meta">
          ✓ Cleared {signedOffAt && <span className="text-admin-muted">on {new Date(signedOffAt).toLocaleString()}</span>}
          {signedOffNote && <p className="mt-2 italic text-admin-muted">&ldquo;{signedOffNote}&rdquo;</p>}
        </div>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sign-off note (min 5 chars)" className="input w-full" rows={3} />
          <button type="button" disabled={pending || !canSignOff} onClick={signOff} className="btn btn-primary px-4 py-2 mt-3 disabled:opacity-50">Sign off</button>
          {reasons.length > 0 && <ul className="mt-3 text-meta text-admin-muted list-disc pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </>
      )}
    </section>
  );
}
