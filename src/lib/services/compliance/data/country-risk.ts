/**
 * Per-country risk score (0 = low, 3 = FATF blacklisted / prohibited).
 * Sources: FATF high-risk + jurisdictions under monitoring; EU AMLD5 high-risk
 * third-country list. Reviewed annually — update both lists below in tandem.
 */
const FATF_BLACKLIST = ["KP", "IR", "MM"];
const FATF_GREYLIST = [
  "AF", "AL", "BB", "BF", "KH", "KY", "CD", "GI", "HT", "JM",
  "JO", "ML", "MZ", "NI", "PA", "PH", "SN", "SS", "SY", "TR",
  "UG", "AE", "YE",
];
// Common offshore / lower-transparency jurisdictions kept at "medium" (2)
// pending a fuller methodology.
const ELEVATED = ["BS", "BZ", "VG", "MH", "VU", "SC"];

export function countryRisk(code: string | null | undefined): 0 | 1 | 2 | 3 {
  if (!code) return 0;
  const c = code.trim().toUpperCase();
  if (FATF_BLACKLIST.includes(c)) return 3;
  if (FATF_GREYLIST.includes(c)) return 2;
  if (ELEVATED.includes(c)) return 2;
  // EU + EFTA + UK + AU/CA/NZ/JP/SG/HK/US as "low"
  const LOW = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    "IS", "LI", "NO", "CH",
    "GB", "US", "CA", "AU", "NZ", "JP", "SG", "HK", "IL",
  ];
  if (LOW.includes(c)) return 0;
  return 1;
}

export const FATF_BLACKLISTED = new Set(FATF_BLACKLIST);
