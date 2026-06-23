import { cache } from "react";
import { getOrgSettings } from "@/lib/services/settings";

/* =====================================================================
   White-label theming + plan tiers (single-org, one deployment per tenant)
   ===================================================================== */

/** Theme presets, mapped from the platform prototype's "Quiet Authority"
 *  palettes. Each value is keyed by the *prototype* token names; `buildThemeVars`
 *  fans these out onto the app's actual CSS custom properties. */
export const THEME_PRESETS = {
  indigo: {
    label: "Indigo",
    vars: { "--brand": "#2E4A8B", "--brand-dark": "#1E3164", "--brand-50": "#EBEFF8", "--accent": "#C9A86A", "--bg": "#F7F8FA", "--surface": "#FFFFFF", "--surface-2": "#F1F3F7", "--border-color": "#E3E7EE", "--border-strong-color": "#CBD2DE", "--text": "#10182A", "--text-muted": "#5A6478" },
  },
  emerald: {
    label: "Emerald",
    vars: { "--brand": "#0B6E4F", "--brand-dark": "#064E36", "--brand-50": "#E7F2EC", "--accent": "#B8924A", "--bg": "#F6F9F7", "--surface": "#FFFFFF", "--surface-2": "#EFF4F1", "--border-color": "#DCE7E1", "--border-strong-color": "#C2D2C9", "--text": "#0E1A14", "--text-muted": "#54655C" },
  },
  gold: {
    label: "Gold",
    vars: { "--brand": "#8A6D2F", "--brand-dark": "#5E4A1E", "--brand-50": "#F4EFE2", "--accent": "#1E3164", "--bg": "#FAF9F6", "--surface": "#FFFFFF", "--surface-2": "#F3F1EA", "--border-color": "#E8E3D6", "--border-strong-color": "#D4CCB8", "--text": "#1A1710", "--text-muted": "#6B6452" },
  },
  burgundy: {
    label: "Burgundy",
    vars: { "--brand": "#7A2233", "--brand-dark": "#561622", "--brand-50": "#F5E9EC", "--accent": "#C9A86A", "--bg": "#FAF7F7", "--surface": "#FFFFFF", "--surface-2": "#F4EEEF", "--border-color": "#EADDDF", "--border-strong-color": "#D8C3C7", "--text": "#1F1115", "--text-muted": "#6B5358" },
  },
  slate: {
    label: "Slate",
    vars: { "--brand": "#3A4252", "--brand-dark": "#252A35", "--brand-50": "#EEF0F3", "--accent": "#8A93A6", "--bg": "#F6F7F9", "--surface": "#FFFFFF", "--surface-2": "#EFF1F4", "--border-color": "#E0E3E9", "--border-strong-color": "#C7CCD6", "--text": "#141821", "--text-muted": "#586075" },
  },
} as const;

export type ThemePreset = keyof typeof THEME_PRESETS;
export const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemePreset[];

/* ── hex helpers (mirror the prototype) ─────────────────────────────── */
function hex2rgb(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgb2hex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}
function darken(h: string, p: number): string { const [r, g, b] = hex2rgb(h); return rgb2hex(r * (1 - p), g * (1 - p), b * (1 - p)); }
function tint(h: string, p: number): string { const [r, g, b] = hex2rgb(h); return rgb2hex(r + (255 - r) * p, g + (255 - g) * p, b + (255 - b) * p); }
function isHex(v: string | null | undefined): v is string { return !!v && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v); }

/** Maps prototype token names onto the app's real CSS custom properties so a
 *  preset recolours brand, surfaces, ink and borders consistently everywhere. */
function buildThemeVars(themePreset: string, accentColor?: string | null): Record<string, string> {
  const preset = THEME_PRESETS[(themePreset as ThemePreset)] ?? THEME_PRESETS.indigo;
  const p = preset.vars as Record<string, string>;
  const out: Record<string, string> = {
    "--brand": p["--brand"],
    "--brand-dark": p["--brand-dark"],
    "--brand-50": p["--brand-50"],
    "--accent": p["--accent"],
    "--ink": p["--text"],
    "--text": p["--text"],
    "--taupe": p["--text-muted"],
    "--text-muted": p["--text-muted"],
    "--bone": p["--surface"],
    "--surface-2": p["--surface-2"],
    "--hairline": p["--border-color"],
    "--border-color": p["--border-color"],
    "--border-strong": p["--border-strong-color"],
    "--border-strong-color": p["--border-strong-color"],
    // shell families (admin + client share the cool palette)
    "--admin-bg": p["--bg"], "--admin-surface": p["--surface"], "--admin-fg": p["--text"], "--admin-muted": p["--text-muted"], "--admin-border": p["--border-color"],
    "--client-bg": p["--bg"], "--client-surface": p["--surface"], "--client-fg": p["--text"], "--client-muted": p["--text-muted"], "--client-border": p["--border-color"],
  };
  // A custom brand colour overrides the preset's primary (matches the prototype's accent picker).
  if (isHex(accentColor)) {
    out["--brand"] = accentColor;
    out["--brand-dark"] = darken(accentColor, 0.18);
    out["--brand-50"] = tint(accentColor, 0.9);
  }
  return out;
}

/** Serialise theme vars into a `:root{…}` block for injection in the document head. */
export function themeCss(themePreset: string, accentColor?: string | null): string {
  const vars = buildThemeVars(themePreset, accentColor);
  const body = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";");
  return `:root{${body}}`;
}

/* ── plan tiers ─────────────────────────────────────────────────────── */
export const PLAN_TIERS = ["starter", "professional", "scale"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
export const TIER_LABELS: Record<PlanTier, string> = { starter: "Starter", professional: "Professional", scale: "Scale" };

function tierRank(t: string): number { return { starter: 0, professional: 1, scale: 2 }[t] ?? 0; }
/** True when `current` plan includes everything in `required` (and below). */
export function tierAtLeast(current: string, required: PlanTier): boolean {
  return tierRank(current) >= tierRank(required);
}

/* ── branding accessor ──────────────────────────────────────────────── */
export type Branding = {
  brandName: string;
  brandMark: string;
  accentColor: string | null;
  themePreset: string;
  planTier: PlanTier;
  contactEmail: string | null;
};

/** Resolved white-label branding for the current deployment. Cached per-request
 *  so repeated reads across server components hit the DB once. */
export const getBranding = cache(async (): Promise<Branding> => {
  const org = await getOrgSettings();
  const brandName = (org.brandName?.trim() || org.displayName || "the platform").trim();
  const brandMark = (org.brandMark?.trim() || brandName[0] || "P").toUpperCase();
  const planTier = (PLAN_TIERS.includes(org.planTier as PlanTier) ? org.planTier : "professional") as PlanTier;
  return {
    brandName,
    brandMark,
    accentColor: isHex(org.accentColor) ? org.accentColor : null,
    themePreset: THEME_KEYS.includes(org.themePreset as ThemePreset) ? org.themePreset : "indigo",
    planTier,
    contactEmail: org.contactEmail,
  };
});
