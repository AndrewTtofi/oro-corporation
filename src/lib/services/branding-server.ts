import { getOrgSettings } from "@/lib/services/settings";

/* =====================================================================
   Server-side white-label branding.

   `getBranding` (branding.ts) is a React `cache()` for server components.
   This is its plain-async sibling for non-React server contexts — the cron
   worker, email/calendar/notification providers, and reference-number
   allocation — where literals like "ORO" must not be hard-coded.

   Every value falls back through org settings to a neutral default; nothing
   here hard-codes a firm name. Configure per deployment via the admin
   branding settings (OrgSettings row).
   ===================================================================== */

export type ServerBranding = {
  /** Public-facing brand, e.g. "Acme Trust". */
  brandName: string;
  /** Legal entity for emails/legal copy, e.g. "Acme Trust Limited". */
  legalName: string;
  /** Uppercase prefix for reference numbers, e.g. "ACME". */
  referencePrefix: string;
  /** Contact email for legal/support copy, or null if unset. */
  contactEmail: string | null;
  /** Governing-law country for legal pages, e.g. "Cyprus". */
  jurisdiction: string;
};

/** Derive a reference-number prefix from a brand name: first word, A–Z only,
 *  up to 6 chars, uppercased. "ORO Corporate Services" → "ORO". */
function derivePrefix(brand: string): string {
  const word = brand.trim().split(/\s+/)[0] ?? "";
  const alpha = word.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase();
  return alpha || "REF";
}

/** Resolved branding for non-React server code. Not request-cached — callers
 *  in hot paths should read once and reuse. */
export async function getServerBranding(): Promise<ServerBranding> {
  const org = await getOrgSettings();
  const brandName = (org.brandName?.trim() || org.displayName || "the platform").trim();
  return {
    brandName,
    legalName: org.legalName?.trim() || brandName,
    referencePrefix: (org.referencePrefix?.trim() || derivePrefix(brandName)).toUpperCase(),
    contactEmail: org.contactEmail?.trim() || null,
    jurisdiction: org.jurisdiction?.trim() || "Cyprus",
  };
}
