/** Jurisdiction reference data for the public comparison + tax-calculator tools.
 *
 *  Corporate income tax and standard VAT/GST rates were verified against
 *  PwC Worldwide Tax Summaries (taxsummaries.pwc.com), reviewed June 2026 — see
 *  `sourceUrl` on each row. Formation time, minimum capital and treaty counts are
 *  indicative only. Headline rates simplify many special regimes — not tax advice. */
export type Jurisdiction = {
  id: string;
  name: string;
  flag: string;
  corpTax: number;   // headline corporate income tax %
  vat: number;       // standard VAT/GST %
  days: number;      // typical formation time, business days (indicative)
  minCap: string;    // minimum share capital, display string (indicative)
  treaties: number;  // double-tax treaties (indicative)
  eu: boolean;
  sourceUrl: string; // PwC Worldwide Tax Summaries page the tax figures were checked against
  note?: string;     // caveat shown on hover / detail
};

/** Month the tax/VAT figures were last reconciled against the source. */
export const RATES_REVIEWED = "June 2026";

const PWC = "https://taxsummaries.pwc.com";

export const JURISDICTIONS: Jurisdiction[] = [
  { id: "cy", name: "Cyprus", flag: "🇨🇾", corpTax: 15, vat: 19, days: 7, minCap: "€1", treaties: 65, eu: true, sourceUrl: `${PWC}/cyprus/corporate/taxes-on-corporate-income`, note: "CIT rose to 15% on 1 Jan 2026 (was 12.5%)." },
  { id: "mt", name: "Malta", flag: "🇲🇹", corpTax: 35, vat: 18, days: 10, minCap: "€1,165", treaties: 70, eu: true, sourceUrl: `${PWC}/malta/corporate/taxes-on-corporate-income`, note: "35% standard; refund regime can lower the effective rate." },
  { id: "ie", name: "Ireland", flag: "🇮🇪", corpTax: 12.5, vat: 23, days: 5, minCap: "€1", treaties: 74, eu: true, sourceUrl: `${PWC}/ireland/corporate/taxes-on-corporate-income`, note: "12.5% trading rate; 15% Pillar Two minimum for large groups." },
  { id: "ee", name: "Estonia", flag: "🇪🇪", corpTax: 22, vat: 24, days: 2, minCap: "€2,500", treaties: 62, eu: true, sourceUrl: `${PWC}/estonia/corporate/taxes-on-corporate-income`, note: "22% on distributed profits only; undistributed profits exempt. VAT 24% from Jul 2025." },
  { id: "ae", name: "UAE", flag: "🇦🇪", corpTax: 9, vat: 5, days: 7, minCap: "AED 0", treaties: 140, eu: false, sourceUrl: `${PWC}/united-arab-emirates/corporate/taxes-on-corporate-income`, note: "9% on profits above AED 375k; 0% below (since Jun 2023)." },
  { id: "gi", name: "Gibraltar", flag: "🇬🇮", corpTax: 15, vat: 0, days: 10, minCap: "£100", treaties: 0, eu: false, sourceUrl: `${PWC}/gibraltar/corporate/taxes-on-corporate-income`, note: "15% since 1 Jul 2024 (was 12.5%); no VAT." },
  { id: "bvi", name: "BVI", flag: "🇻🇬", corpTax: 0, vat: 0, days: 3, minCap: "$1", treaties: 0, eu: false, sourceUrl: `${PWC}/quick-charts/corporate-income-tax-cit-rates`, note: "No corporate income tax; no VAT." },
  { id: "lu", name: "Luxembourg", flag: "🇱🇺", corpTax: 23.87, vat: 17, days: 12, minCap: "€12,000", treaties: 86, eu: true, sourceUrl: `${PWC}/luxembourg/corporate/taxes-on-corporate-income`, note: "Aggregate Luxembourg-City rate; reduced from 24.94% in 2025." },
  { id: "nl", name: "Netherlands", flag: "🇳🇱", corpTax: 25.8, vat: 21, days: 7, minCap: "€0.01", treaties: 95, eu: true, sourceUrl: `${PWC}/netherlands/corporate/taxes-on-corporate-income`, note: "25.8% top rate; 19% on the first €200k of profit." },
  { id: "ch", name: "Switzerland", flag: "🇨🇭", corpTax: 19.6, vat: 8.1, days: 14, minCap: "CHF 20,000", treaties: 100, eu: false, sourceUrl: `${PWC}/switzerland/corporate/taxes-on-corporate-income`, note: "Representative Zurich rate; effective combined rate varies ~11.9–21% by canton." },
  { id: "sg", name: "Singapore", flag: "🇸🇬", corpTax: 17, vat: 9, days: 3, minCap: "S$1", treaties: 90, eu: false, sourceUrl: `${PWC}/singapore/corporate/taxes-on-corporate-income`, note: "GST raised to 9% in 2024." },
  { id: "uk", name: "United Kingdom", flag: "🇬🇧", corpTax: 25, vat: 20, days: 1, minCap: "£1", treaties: 130, eu: false, sourceUrl: `${PWC}/united-kingdom/corporate/taxes-on-corporate-income`, note: "25% main rate; 19% small-profits rate below £50k." },
  { id: "pt", name: "Portugal", flag: "🇵🇹", corpTax: 19, vat: 23, days: 8, minCap: "€1", treaties: 79, eu: true, sourceUrl: `${PWC}/portugal/corporate/taxes-on-corporate-income`, note: "CIT reduced to 19% in 2025 (was 21%); surcharges may apply." },
  { id: "bg", name: "Bulgaria", flag: "🇧🇬", corpTax: 10, vat: 20, days: 7, minCap: "BGN 2", treaties: 69, eu: true, sourceUrl: `${PWC}/bulgaria/corporate/taxes-on-corporate-income` },
  { id: "hu", name: "Hungary", flag: "🇭🇺", corpTax: 9, vat: 27, days: 5, minCap: "HUF 3M", treaties: 80, eu: true, sourceUrl: `${PWC}/hungary/corporate/taxes-on-corporate-income`, note: "Lowest headline CIT in the EU; VAT is the EU's highest at 27%." },
  { id: "hk", name: "Hong Kong", flag: "🇭🇰", corpTax: 16.5, vat: 0, days: 4, minCap: "HK$1", treaties: 45, eu: false, sourceUrl: `${PWC}/hong-kong-sar/corporate/taxes-on-corporate-income`, note: "Two-tier profits tax; 16.5% above HKD 2m, 8.25% below. No VAT/GST." },
  { id: "ky", name: "Cayman Islands", flag: "🇰🇾", corpTax: 0, vat: 0, days: 5, minCap: "$1", treaties: 0, eu: false, sourceUrl: `${PWC}/cayman-islands/corporate/taxes-on-corporate-income`, note: "No corporate income tax; no VAT." },
  { id: "im", name: "Isle of Man", flag: "🇮🇲", corpTax: 0, vat: 20, days: 6, minCap: "£1", treaties: 11, eu: false, sourceUrl: `${PWC}/isle-of-man/corporate/taxes-on-corporate-income`, note: "0% standard corporate rate; VAT at UK parity (20%)." },
];

/** Headline corporate rates for "current country" in the tax calculator
 *  (indicative; verify before relying). */
export const HOME_COUNTRY_RATES: Record<string, number> = {
  "United Kingdom": 25,
  Germany: 30,
  France: 25,
  "United States": 27,
  Sweden: 20.6,
  Italy: 24,
};
