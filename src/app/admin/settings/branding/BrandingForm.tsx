"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

/* Client-safe palette mirror of THEME_PRESETS (avoid importing the server
   branding module, which pulls in Prisma). Keep keys/colours in sync. */
const THEME_SWATCHES: { key: string; label: string; brand: string }[] = [
  { key: "indigo", label: "Indigo", brand: "#2E4A8B" },
  { key: "emerald", label: "Emerald", brand: "#0B6E4F" },
  { key: "gold", label: "Gold", brand: "#8A6D2F" },
  { key: "burgundy", label: "Burgundy", brand: "#7A2233" },
  { key: "slate", label: "Slate", brand: "#3A4252" },
];

const TIERS: { key: string; label: string; desc: string }[] = [
  { key: "starter", label: "Starter", desc: "Core qualification gate + client dashboard. No partner portal, white-label, AML or compliance calendar." },
  { key: "professional", label: "Professional", desc: "Adds conditional forms, CRM, partner portal, compliance calendar and WhatsApp reminders." },
  { key: "scale", label: "Scale", desc: "Adds full white-label theming, AML / KYC screening, multi-language and API integrations." },
];

type Initial = { brandName: string; brandMark: string; logo: string; accentColor: string; themePreset: string; planTier: string };

function hex2rgb(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgb2hex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}
const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

export function BrandingForm({ initial, canEditPlan }: { initial: Initial; canEditPlan: boolean }) {
  const [brandName, setBrandName] = useState(initial.brandName);
  const [brandMark, setBrandMark] = useState(initial.brandMark);
  const [logo, setLogo] = useState(initial.logo);
  const [accentColor, setAccentColor] = useState(initial.accentColor);

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
  const [themePreset, setThemePreset] = useState(initial.themePreset);
  const [planTier, setPlanTier] = useState(initial.planTier);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const effectiveBrand = isHex(accentColor)
    ? accentColor
    : THEME_SWATCHES.find((t) => t.key === themePreset)?.brand ?? "#2E4A8B";
  const mark = (brandMark || brandName.trim()[0] || "O").toUpperCase();

  // Live-preview: paint the chosen brand colour onto the page while editing.
  useEffect(() => {
    const root = document.documentElement;
    const prevBrand = root.style.getPropertyValue("--brand");
    const prev50 = root.style.getPropertyValue("--brand-50");
    root.style.setProperty("--brand", effectiveBrand);
    if (isHex(effectiveBrand)) {
      const [r, g, b] = hex2rgb(effectiveBrand);
      root.style.setProperty("--brand-50", rgb2hex(r + (255 - r) * 0.9, g + (255 - g) * 0.9, b + (255 - b) * 0.9));
    }
    return () => {
      root.style.setProperty("--brand", prevBrand);
      root.style.setProperty("--brand-50", prev50);
    };
  }, [effectiveBrand]);

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
          accentColor: isHex(accentColor) ? accentColor : "",
          themePreset,
          // Plan tier is operator-controlled — only sent by a super admin.
          ...(canEditPlan ? { planTier } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? "Saved — reloading to apply theme…" : (body.error ?? "Failed to save."));
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
    <div className="twocol">
      <div>
        <div className="card mb-4">
          <h3 className="card-title">Branding · white-label</h3>
          <div className="field">
            <label>Brand name</label>
            <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Meridian Corporate Services" />
          </div>
          <div className="field">
            <label>Wordmark letter</label>
            <input className="input" maxLength={2} value={brandMark} onChange={(e) => setBrandMark(e.target.value)} placeholder={mark} style={{ maxWidth: 100 }} />
            <div className="help">Shown in the square logo mark when no logo image is uploaded. Defaults to the first letter of the brand name.</div>
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
            <div className="help">PNG, JPEG, WEBP or SVG, under 1MB. Replaces the wordmark letter everywhere (sidebars, login, marketing, emails-in-app) after saving.</div>
          </div>

          <hr className="hairline" style={{ margin: "var(--space-5) 0" }} />

          <div className="field">
            <label>Theme preset</label>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {THEME_SWATCHES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setThemePreset(t.key); setAccentColor(""); }}
                  title={t.label}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: `2px solid ${themePreset === t.key && !isHex(accentColor) ? "var(--text)" : "transparent"}`,
                    background: t.brand, cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="field">
            <label>Custom brand colour (overrides preset)</label>
            <div className="row gap-3">
              <input type="color" value={isHex(accentColor) ? accentColor : effectiveBrand} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 48, height: 40, border: "1px solid var(--border-strong-color)", borderRadius: "var(--radius-sm)", cursor: "pointer" }} />
              {isHex(accentColor) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccentColor("")}>Clear</button>}
            </div>
          </div>

          <div className="card mt-4" style={{ background: "var(--surface-2)", borderColor: "transparent" }}>
            <div className="muted" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Live preview</div>
            <div className="row-between">
              <div className="wordmark" style={{ fontSize: "var(--fs-body)" }}>
                <span className="seal" />
                <BrandMark logo={logo || null} mark={mark} style={{ width: 24, height: 24, fontSize: 12 }} />
                <span>{brandName || "Your brand"}</span>
              </div>
              <button type="button" className="btn btn-primary btn-sm">Primary button</button>
            </div>
          </div>
          <p className="help mt-3">Changes apply across the whole platform after saving — proving one codebase, many brands.</p>
        </div>
      </div>

      <div>
        <div className="card mb-4">
          <div className="row-between mb-2">
            <h3 className="card-title" style={{ marginBottom: 0 }}>Plan tier</h3>
            {canEditPlan
              ? <span className="badge badge-new"><span className="bdot" />Super admin</span>
              : <span className="badge badge-neutral"><span className="bdot" />Read-only</span>}
          </div>
          <p className="muted mb-4" style={{ fontSize: "var(--fs-xs)" }}>
            {canEditPlan
              ? "Switching tiers toggles feature availability (partner portal, compliance calendar, AML)."
              : "Your plan is managed by your platform provider. Contact them to change it."}
          </p>
          <div className="stack gap-2">
            {TIERS.map((t) => {
              const active = planTier === t.key;
              const dim = !canEditPlan && !active;
              return (
                <div
                  key={t.key}
                  onClick={canEditPlan ? () => setPlanTier(t.key) : undefined}
                  className="card"
                  style={{
                    cursor: canEditPlan ? "pointer" : "default",
                    padding: "var(--space-4)",
                    borderColor: active ? "var(--brand)" : undefined,
                    boxShadow: active ? "var(--shadow-sm)" : undefined,
                    opacity: dim ? 0.55 : 1,
                  }}
                >
                  <div className="row-between">
                    <strong>{t.label}</strong>
                    {active && <span className="badge badge-approved"><span className="bdot" />Active</span>}
                  </div>
                  <p className="muted mt-2" style={{ fontSize: "var(--fs-xs)" }}>{t.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    <div className="row gap-3 mt-6" style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-5)" }}>
      <button type="button" disabled={pending} className="btn btn-primary" onClick={save}>{pending ? "Saving…" : canEditPlan ? "Save branding & plan" : "Save branding"}</button>
      {msg && <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{msg}</span>}
    </div>
    </>
  );
}
