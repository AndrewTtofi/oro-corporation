/** Static reference data for the compliance suite (AML reporting, integrations,
 *  webhooks). Ported from the prototype; client-safe. */
export const AML_TEMPLATES = [
  { id: "sar", name: "Suspicious Activity / Transaction Report", icon: "flag", reg: "FIU / goAML", desc: "Pre-filled SAR/STR aligned to FIU schema, drawing on flagged screening matches and source-of-funds notes." },
  { id: "periodic", name: "Periodic AML Review", icon: "shield", reg: "AMLD / risk-based", desc: "Portfolio-wide review summarising risk ratings, EDD cases and screening outcomes for the review period." },
  { id: "kyc", name: "KYC Refresh Due", icon: "passport", reg: "Ongoing CDD", desc: "Clients whose identity documents or risk profiles are due for refresh, with a ready-to-send request pack." },
  { id: "ubo", name: "UBO Register Confirmation", icon: "users", reg: "UBO register", desc: "Annual confirmation of ultimate beneficial owners at the 25% threshold, sourced from the ownership map." },
];

export const AML_REPORT_LOG = [
  { report: "Suspicious Activity Report", subject: "Larsen Capital", reg: "goAML", icon: "flag", by: "A. Demetriou", at: "2026-06-19 16:40", status: "submitted" },
  { report: "Periodic AML Review · H1", subject: "Portfolio · 7 clients", reg: "AMLD", icon: "shield", by: "A. Demetriou", at: "2026-06-15 09:05", status: "approved" },
  { report: "UBO Register Confirmation", subject: "Northwind Holdings Ltd", reg: "UBO register", icon: "users", by: "M. Petrou", at: "2026-06-12 11:22", status: "approved" },
  { report: "KYC Refresh Pack", subject: "Singh Ventures FZE", reg: "Ongoing CDD", icon: "passport", by: "System", at: "2026-06-10 08:00", status: "submitted" },
];

export const INTEGRATIONS = [
  { id: "id", name: "ID verification", vendor: "iDenfy", icon: "passport", status: "connected", lastSync: "2026-06-21 09:04", desc: "Document + biometric liveness and face-match. Vendor: iDenfy / Onfido / Veriff." },
  { id: "aml", name: "AML screening", vendor: "ComplyAdvantage", icon: "shield", status: "connected", lastSync: "2026-06-21 08:58", desc: "Sanctions, PEP and adverse-media monitoring. Vendor: ComplyAdvantage." },
  { id: "kyb", name: "Company registry / KYB", vendor: "Registry aggregator", icon: "building", status: "connected", lastSync: "2026-06-21 07:32", desc: "Corporate records and UBO data across 200+ countries via a KYB aggregator." },
  { id: "sign", name: "E-signature", vendor: "DocuSign", icon: "pen", status: "available", lastSync: "", desc: "Send engagement letters and forms for legally binding e-signature." },
  { id: "pay", name: "Payments", vendor: "Stripe", icon: "card", status: "connected", lastSync: "2026-06-21 06:15", desc: "Collect fees and retainers; invoices sync to client profiles. Vendor: Stripe." },
  { id: "cal", name: "Calendar", vendor: "Cal.com", icon: "calendar", status: "connected", lastSync: "2026-06-21 09:01", desc: "Two-way booking sync for consultations once a client is approved. Vendor: Cal.com." },
  { id: "msg", name: "WhatsApp / SMS", vendor: "Twilio", icon: "phone", status: "available", lastSync: "", desc: "Document-request and reminder messaging over WhatsApp and SMS. Vendor: Twilio." },
  { id: "acct", name: "Accounting", vendor: "Xero", icon: "briefcase", status: "available", lastSync: "", desc: "Push approved clients and invoices into your ledger. Vendor: Xero / QuickBooks." },
];

export const WEBHOOKS = [
  { event: "application.submitted", desc: "New intake completed and submitted", endpoint: "https://api.firm.example/hooks/intake", deliveries: "312", active: true },
  { event: "screening.flagged", desc: "AML / PEP / adverse-media hit", endpoint: "https://api.firm.example/hooks/risk", deliveries: "47", active: true },
  { event: "document.verified", desc: "ID or proof-of-address verified", endpoint: "https://api.firm.example/hooks/docs", deliveries: "598", active: true },
  { event: "payment.succeeded", desc: "Fee or retainer collected", endpoint: "https://api.firm.example/hooks/billing", deliveries: "128", active: false },
];

export const API_KEY = "sk_live_••••••••••••••••••••••3f9a";
export const API_BASE = "https://api.connect.example/v1";
