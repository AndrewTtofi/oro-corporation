/** Service catalogue (prototype SERVICES) — client-safe reference data for the
 *  advisor, marketplace matching and intake. */
export type ServiceDef = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  priceFrom: string;
  billing: "one-off" | "monthly";
  timeline: string;
  docs: string[];
};

export const SERVICE_DEFS: ServiceDef[] = [
  { id: "formation", name: "Company Formation", icon: "building", desc: "Incorporate a company end-to-end, from name reservation to registration and corporate bank introduction.", priceFrom: "€1,200", billing: "one-off", timeline: "5–10 business days", docs: ["Passport", "Proof of Address", "Business Plan"] },
  { id: "accounting", name: "Accounting & Tax", icon: "briefcase", desc: "Ongoing bookkeeping, VAT registration and returns, and annual financial statements.", priceFrom: "€300", billing: "monthly", timeline: "Ongoing", docs: ["Passport", "Proof of Address"] },
  { id: "residency", name: "Tax Residency", icon: "globe", desc: "Personal tax-residency and non-dom structuring, including the 60-day route where applicable.", priceFrom: "€2,500", billing: "one-off", timeline: "2–4 weeks", docs: ["Passport", "Proof of Address", "Source of Funds"] },
  { id: "immigration", name: "Immigration", icon: "flag", desc: "Work permits, residence permits and digital-nomad visas for founders and key staff.", priceFrom: "€3,000", billing: "one-off", timeline: "1–3 months", docs: ["Passport", "Proof of Address"] },
  { id: "licensing", name: "Licensing", icon: "shield", desc: "Regulatory licensing for forex, crypto and EMI businesses, including substance planning.", priceFrom: "€4,500", billing: "one-off", timeline: "3–6 months", docs: ["Passport", "Proof of Address", "Business Plan", "Source of Funds"] },
  { id: "banking", name: "Banking", icon: "bank", desc: "Corporate and personal bank-account introductions with our partner institutions.", priceFrom: "€900", billing: "one-off", timeline: "2–5 weeks", docs: ["Passport", "Proof of Address"] },
];

export const svcDef = (id: string): ServiceDef => SERVICE_DEFS.find((s) => s.id === id) ?? SERVICE_DEFS[0];
