"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

type Initial = { brandName: string; brandMark: string; logo: string };

export function BrandIdentityForm({ initial }: { initial: Initial }) {
  const [brandName, setBrandName] = useState(initial.brandName);
  const [brandMark, setBrandMark] = useState(initial.brandMark);
  const [logo, setLogo] = useState(initial.logo);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const mark = (brandMark || brandName.trim()[0] || "O").toUpperCase();

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 1_000_000) { setMsg("Logo too large — keep it under 1MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { setLogo(reader.result); setMsg(null); } };
    reader.readAsDataURL(file);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/admin/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim() || null,
          brandMark: brandMark.trim() || null,
          logo,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? "Saved — reloading to apply…" : (body.error ?? "Failed to save."));
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="card mb-4" style={{ maxWidth: 560 }}>
      <h3 className="card-title">Logo &amp; name</h3>

      <div className="field">
        <label>Brand name</label>
        <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Meridian Corporate Services" />
      </div>

      <div className="field">
        <label>Wordmark letter</label>
        <input className="input" maxLength={2} value={brandMark} onChange={(e) => setBrandMark(e.target.value)} placeholder={mark} style={{ maxWidth: 100 }} />
        <div className="help">Shown in the square mark when no logo is uploaded. Defaults to the first letter of the brand name.</div>
      </div>

      <div className="field">
        <label>Logo image</label>
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <BrandMark logo={logo || null} mark={mark} style={{ width: 40, height: 40 }} />
          <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
            {logo ? "Replace" : "Upload"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogoFile} style={{ display: "none" }} />
          </label>
          {logo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLogo("")}>Remove</button>}
        </div>
        <div className="help">PNG, JPEG, WEBP or SVG, under 1MB. Replaces the wordmark letter everywhere after saving.</div>
      </div>

      <div className="card mt-4" style={{ background: "var(--surface-2)", borderColor: "transparent" }}>
        <div className="muted" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Live preview</div>
        <div className="wordmark" style={{ fontSize: "var(--fs-body)" }}>
          <span className="seal" />
          <BrandMark logo={logo || null} mark={mark} style={{ width: 24, height: 24, fontSize: 12 }} />
          <span>{brandName || "Your brand"}</span>
        </div>
      </div>

      <div className="row gap-3 mt-4" style={{ alignItems: "center" }}>
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary px-5 py-2.5 disabled:opacity-50">
          {pending ? "Saving…" : "Save branding"}
        </button>
        {msg && <span className="text-meta text-admin-muted">{msg}</span>}
      </div>
    </div>
  );
}
