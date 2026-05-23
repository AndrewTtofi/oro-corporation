// Inline SVG icons sourced from landing.html / services.html — kept here
// so both surfaces stay in lockstep when icons change.

export const ServiceIcons = {
  formation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 7v1h18V7M3 10v11M21 10v11M9 21V10M15 21V10M10 3l2-2 2 2" />
    </svg>
  ),
  accounting: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a2.5 2.5 0 0 1 2.5-2.5H20" />
    </svg>
  ),
  tax: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  immigration: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  licensing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  banking: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
} as const;

export type ServiceKey = keyof typeof ServiceIcons;

export const SERVICES: { key: ServiceKey; title: string; blurb: string; longBlurb: string; pickerBlurb: string }[] = [
  {
    key: "formation",
    title: "Company Formation",
    blurb: "Full incorporation services for Cyprus companies, including registered office and secretary.",
    longBlurb: "End-to-end incorporation with the Registrar of Companies, plus registered office, company secretary, and ongoing corporate administration.",
    pickerBlurb: "Full incorporation and registered office setup.",
  },
  {
    key: "accounting",
    title: "Accounting & VAT",
    blurb: "Professional bookkeeping, management accounts, and VAT compliance for your business.",
    longBlurb: "Monthly bookkeeping, quarterly VAT submissions, management accounts, and statutory audit coordination.",
    pickerBlurb: "On-going compliance and professional bookkeeping.",
  },
  {
    key: "tax",
    title: "Tax Residency",
    blurb: "Specialized advice on Non-Dom tax residency and individual tax planning in Cyprus.",
    longBlurb: "Cyprus Non-Dom certification, 60-day rule applications, and individual tax planning for relocating professionals.",
    pickerBlurb: "Non-Dom status and individual tax planning.",
  },
  {
    key: "immigration",
    title: "Immigration",
    blurb: "Residency permits, work visas, and citizenship solutions for you and your family.",
    longBlurb: "Pink slip, digital nomad, work permits, permanent residency, and EU citizenship advisory for you and your dependents.",
    pickerBlurb: "Residency permits and citizenship solutions.",
  },
  {
    key: "licensing",
    title: "Licensing",
    blurb: "Assistance with obtaining financial, gambling, or crypto licenses in the EU.",
    longBlurb: "CySEC investment-firm licenses, CASP / crypto-asset providers, EMI, and gambling licenses — application through approval.",
    pickerBlurb: "EMI, CASP, and Gambling license acquisition.",
  },
  {
    key: "banking",
    title: "Banking Solutions",
    blurb: "Introductions and support for corporate and personal bank account opening.",
    longBlurb: "Curated introductions to 25+ EU/EEA banking partners with full KYC packaging for corporate and personal accounts.",
    pickerBlurb: "Corporate and personal bank account opening.",
  },
];
