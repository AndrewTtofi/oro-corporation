import { prisma } from "@/lib/db";
import { SERVICE_KEYS } from "@/lib/schema/onboarding";

/** Known feature-flag keys exposed in the admin UI. Adding a key here makes it
 *  show up on /admin/settings/flags. The corresponding env-presence check lives
 *  alongside in `KNOWN_FLAGS`. */
export const KNOWN_FLAGS = [
  { key: "googleOAuth",   label: "Google OAuth sign-in",   envHint: "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET" },
  { key: "linkedinOAuth", label: "LinkedIn OAuth sign-in", envHint: "LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET" },
  { key: "whatsapp",      label: "WhatsApp notifications", envHint: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM" },
] as const;

export type FlagKey = (typeof KNOWN_FLAGS)[number]["key"];

/** Onboarding document-upload phase modes (OrgSettings.documentsPhase). */
export type DocumentsPhase = "mandatory" | "optional" | "off";

/** Read the configured onboarding document-upload phase mode (defaults to
 *  "mandatory" for any unexpected stored value). */
export async function getDocumentsPhase(): Promise<DocumentsPhase> {
  const org = await getOrgSettings();
  const v = org.documentsPhase;
  return v === "optional" || v === "off" ? v : "mandatory";
}

const DEFAULT_SERVICE_LABELS: Record<string, string> = {
  company_formation: "Company Formation",
  accounting: "Accounting",
  tax_residency: "Tax Residency",
  immigration: "Immigration",
  licensing: "Licensing",
  banking: "Banking",
};

/** Returns the singleton org row, creating it on first access. Race-safe: many
 *  pages may read branding concurrently (e.g. during a build/prerender), so a
 *  lost create() race falls back to re-reading the now-existing row. */
export async function getOrgSettings() {
  const existing = await prisma.orgSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  try {
    return await prisma.orgSettings.create({ data: { id: "singleton" } });
  } catch {
    return (await prisma.orgSettings.findUnique({ where: { id: "singleton" } }))!;
  }
}

/** Returns all services in admin sort order. Auto-seeds the hard-coded
 *  SERVICE_KEYS the first time the table is empty so the app behaves the same
 *  as before any taxonomy edits. */
export async function getServices(opts: { activeOnly?: boolean } = {}) {
  const count = await prisma.service.count();
  if (count === 0) {
    await prisma.service.createMany({
      data: SERVICE_KEYS.map((key, i) => ({
        key,
        label: DEFAULT_SERVICE_LABELS[key] ?? key,
        sortOrder: i,
      })),
    });
  }
  return prisma.service.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

/** Read a single flag (defaults to false if unset). */
export async function getFlag(key: FlagKey): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } });
  return row?.enabled ?? false;
}

export async function getAllFlags(): Promise<Record<string, boolean>> {
  const rows = await prisma.featureFlag.findMany();
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.key] = r.enabled;
  return out;
}
