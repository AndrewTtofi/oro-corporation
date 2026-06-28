"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface DocPill { id: string; name: string; size: number }
type DocType = "passport" | "proof_of_address" | "other";

export function DocumentUploader({
  initial,
  mode = "mandatory",
}: {
  initial: { passport: DocPill | null; proof: DocPill | null; extras: DocPill[] };
  mode?: "mandatory" | "optional";
}) {
  const [passport, setPassport] = useState<DocPill | null>(initial.passport);
  const [proof, setProof] = useState<DocPill | null>(initial.proof);
  const [extras, setExtras] = useState<DocPill[]>(initial.extras);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const router = useRouter();

  const docsRequired = mode === "mandatory";
  const canSubmit = docsRequired ? !!passport && !!proof : true;

  async function uploadOne(type: DocType, file: File): Promise<DocPill | null> {
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large — 10MB max");
      return null;
    }
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Upload failed");
      return null;
    }
    const body = (await res.json()) as { document: { id: string; originalName: string; sizeBytes: number } };
    setError(null);
    return { id: body.document.id, name: body.document.originalName, size: body.document.sizeBytes };
  }

  async function removeOne(id: string) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
  }

  function onSubmit() {
    if (!canSubmit) {
      setError("Passport and Proof of Address are both required.");
      return;
    }
    setError(null);
    startSubmit(async () => {
      const res = await fetch("/api/onboarding/submit", { method: "PUT" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Submission failed");
        return;
      }
      router.push("/onboarding/success");
    });
  }

  return (
    <>
      <div className="flex flex-col gap-10 mb-16">
        <UploadCard
          title="Passport or National ID"
          required={docsRequired}
          body="A clear, high-resolution scan of your valid passport (photo page) or both sides of your ID card."
          file={passport}
          onPick={async (f) => { const p = await uploadOne("passport", f); if (p) setPassport(p); }}
          onRemove={async () => { if (passport) { await removeOne(passport.id); setPassport(null); } }}
        />
        <UploadCard
          title="Proof of Address"
          required={docsRequired}
          body="A utility bill (electricity, water, gas) or bank statement, less than 3 months old, showing your current address."
          file={proof}
          onPick={async (f) => { const p = await uploadOne("proof_of_address", f); if (p) setProof(p); }}
          onRemove={async () => { if (proof) { await removeOne(proof.id); setProof(null); } }}
        />
        <ExtrasCard
          extras={extras}
          onAdd={async (f) => { const p = await uploadOne("other", f); if (p) setExtras((e) => [...e, p]); }}
          onRemove={async (id) => { await removeOne(id); setExtras((e) => e.filter((x) => x.id !== id)); }}
        />
      </div>

      {error && (
        <div className="rounded-elem p-4 text-meta mb-8" style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
          {error}
        </div>
      )}

      <div className="surface rounded-card p-6 flex justify-between items-center flex-wrap gap-3">
        <button type="button" onClick={() => router.push("/onboarding/details")} className="btn btn-ghost px-6 py-3">
          Back to form
        </button>
        <button type="button" disabled={!canSubmit || submitting} onClick={onSubmit}
                className="btn btn-accent px-8 py-3.5 disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
      </div>
    </>
  );
}

function UploadCard({
  title, body, required, file, onPick, onRemove,
}: {
  title: string;
  body: string;
  required: boolean;
  file: DocPill | null;
  onPick: (f: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = `upload-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="surface rounded-card p-8">
      <h3 className="text-lg font-semibold mb-1.5">
        {title}{" "}
        <span className="text-meta font-normal text-muted">({required ? "required" : "optional"})</span>
      </h3>
      <p className="text-meta text-muted mb-6">{body}</p>

      {!file ? (
        <label
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) await onPick(f);
          }}
          className="block cursor-pointer rounded-elem text-center transition-all p-10 border-2 border-dashed"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--border)",
            background: dragging ? "color-mix(in oklch, var(--accent) 4%, var(--surface))" : "transparent",
          }}
        >
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
               className="mx-auto mb-4 text-muted">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div className="text-meta text-muted">
            <span className="text-fg font-semibold">Click to upload</span> or drag and drop<br />
            PDF, JPG, or PNG (max 10MB)
          </div>
          <input id={inputId} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                 onChange={async (e) => { const input = e.currentTarget; const f = input.files?.[0]; if (f) await onPick(f); input.value = ""; }} />
        </label>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-elem p-3.5"
             style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-accent shrink-0">✓</span>
            <span className="text-meta font-medium truncate">{file.name}</span>
            <span className="text-[12px] text-muted shrink-0">{formatSize(file.size)}</span>
          </div>
          <button type="button" onClick={onRemove} className="text-meta text-muted hover:text-fg">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function ExtrasCard({
  extras, onAdd, onRemove,
}: {
  extras: DocPill[];
  onAdd: (f: File) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <div className="surface rounded-card p-8">
      <h3 className="text-lg font-semibold mb-1.5">
        Additional Supporting Documents <span className="text-meta font-normal text-muted">(optional)</span>
      </h3>
      <p className="text-meta text-muted mb-6">Any other relevant documents such as a CV, business plan, or existing company documents.</p>

      <ul className="flex flex-col gap-3 mb-4">
        {extras.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 rounded-elem p-3.5"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-accent shrink-0">✓</span>
              <span className="text-meta font-medium truncate">{d.name}</span>
              <span className="text-[12px] text-muted shrink-0">{formatSize(d.size)}</span>
            </div>
            <button type="button" onClick={() => onRemove(d.id)} className="text-meta text-muted hover:text-fg">
              Remove
            </button>
          </li>
        ))}
      </ul>

      <label htmlFor="upload-extra" className="block cursor-pointer rounded-elem text-center p-6 border-2 border-dashed text-meta text-muted"
             style={{ borderColor: "var(--border)" }}>
        <span className="text-fg font-semibold">Add another file</span> · PDF, JPG, or PNG (max 10MB)
        <input id="upload-extra" type="file" className="hidden"
               accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
               onChange={async (e) => { const input = e.currentTarget; const f = input.files?.[0]; if (f) await onAdd(f); input.value = ""; }} />
      </label>
    </div>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
