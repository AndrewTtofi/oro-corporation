/* =====================================================================
   Compliance intelligence — deterministic, derived from real prospects.
   Mirrors the prototype's KYC/KYB/risk/AI-screening/ownership logic. The
   "soft" data (face-match %, hits, scores, synthetic ownership) is computed
   from the reference so it's stable; real provider hookups are stubbed and
   surfaced as "Coming soon" in the UI.
   ===================================================================== */
import { JURISDICTIONS } from "@/lib/data/jurisdictions";
import { amlResult } from "@/lib/services/aml";

export type Sub = {
  ref: string;
  name: string;
  nationality: string;
  company: string;          // "—" when individual
  serviceId: string;
  jurisdictionId: string;
  nonEU: boolean;
  completeness: "low" | "med" | "high" | null;
};

const EU_NATIONS = new Set(["Cyprus", "Malta", "Ireland", "Estonia", "Luxembourg", "Netherlands", "Portugal", "Bulgaria", "Hungary", "France", "Germany", "Italy", "Spain", "Greece", "Austria", "Belgium", "Sweden", "Denmark", "Finland", "Poland", "Czechia", "Romania", "Croatia", "Slovakia", "Slovenia", "Lithuania", "Latvia"]);
const FLAGS: Record<string, string> = { Nigeria: "🇳🇬", Denmark: "🇩🇰", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪", India: "🇮🇳", Czechia: "🇨🇿", Portugal: "🇵🇹", France: "🇫🇷", Singapore: "🇸🇬", Germany: "🇩🇪", Norway: "🇳🇴", Cyprus: "🇨🇾", Malta: "🇲🇹", Russia: "🇷🇺", "United Kingdom": "🇬🇧", Switzerland: "🇨🇭", BVI: "🇻🇬", Jersey: "🇯🇪" };
export const countryFlag = (c: string) => FLAGS[c] ?? "🌐";
export const jurById = (id: string) => JURISDICTIONS.find((j) => j.id === id) ?? JURISDICTIONS[0];
const hash = (s: string) => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0);

/** Map a Prisma prospect (+ details) to the normalized Sub shape. */
export function prospectToSub(p: {
  referenceNumber: string;
  user: { fullName: string };
  servicesSelected: unknown;
  completeness: string | null;
  completenessOverride: string | null;
  details?: { fieldName: string; fieldValue: string }[];
}): Sub {
  const d = Object.fromEntries((p.details ?? []).map((x) => [x.fieldName, x.fieldValue]));
  const services = Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : [];
  const nationality = d.nationality || d.residenceCountry || "—";
  const company = d.proposedCompanyName || d.company || "—";
  // Best-effort jurisdiction: explicit field, else default Cyprus.
  const jurName = (d.currentJurisdiction || d.currentTaxResidency || "").toLowerCase();
  const jurisdictionId = JURISDICTIONS.find((j) => j.name.toLowerCase() === jurName)?.id ?? "cy";
  return {
    ref: p.referenceNumber,
    name: p.user.fullName,
    nationality,
    company,
    serviceId: services[0] ?? "formation",
    jurisdictionId,
    nonEU: nationality !== "—" && !EU_NATIONS.has(nationality),
    completeness: (p.completenessOverride ?? p.completeness) as Sub["completeness"],
  };
}

/* ── KYC / ID verification ─────────────────────────────────────────── */
export type Kyc = { docType: string; docCountry: string; faceMatch: number; liveness: boolean; deepfake: boolean; status: "verified" | "review"; docNumber: string; expiry: string; confidence: number };
export function kycResult(s: Sub): Kyc {
  const h = hash(s.ref);
  const docType = h % 3 === 0 ? "National ID" : "Passport";
  const faceMatch = 78 + (h % 21);
  const liveness = h % 7 !== 0;
  const deepfake = h % 5 !== 0;
  const status: Kyc["status"] = !liveness || !deepfake || faceMatch < 82 ? "review" : "verified";
  return { docType, docCountry: s.nationality, faceMatch, liveness, deepfake, status,
    docNumber: (docType === "Passport" ? "P" : "ID") + String.fromCharCode(65 + (h % 26)) + (10000000 + ((h * 7919) % 89999999)),
    expiry: "20" + (30 + (h % 6)) + "-0" + (1 + (h % 9)) + "-" + (10 + (h % 18)),
    confidence: Math.min(99, 84 + (h % 15)) };
}

/* ── Ownership / UBO (synthesised for corporate subjects) ───────────── */
export type OwnerNode = { name: string; type: "person" | "entity"; pct: number; jur: string; flag: string; role: string; kyc: "verified" | "pending" | "n-a"; screen: "clear" | "review" | "pep" | "adverse" | "n-a"; children?: OwnerNode[] };
export type Ownership = { entity: string; jur: string; flag: string; regNo: string; type: string; tree: OwnerNode[] };

export function ownershipFor(s: Sub): Ownership | null {
  if (!s.company || s.company === "—") return null;
  const h = hash(s.ref);
  const j = jurById(s.jurisdictionId);
  const flag = countryFlag(s.nationality);
  const corpScreen: OwnerNode["screen"] = h % 2 ? "review" : "clear";
  const uboScreen: OwnerNode["screen"] = h % 3 === 0 ? "pep" : "clear";
  return {
    entity: s.company, jur: s.jurisdictionId, flag: j.flag,
    regNo: ({ cy: "HE ", mt: "C ", ae: "DMCC ", gi: "GIB " }[s.jurisdictionId] ?? "REG ") + (120000 + (h * 317) % 780000),
    type: `Private company · ${j.name}`,
    tree: [
      { name: s.name, type: "person", pct: 60, jur: s.nationality, flag, role: "Director & shareholder", kyc: "verified", screen: "clear" },
      { name: `${s.company.split(" ")[0]} Holdings Ltd`, type: "entity", pct: 40, jur: "BVI", flag: "🇻🇬", role: "Corporate shareholder", kyc: "pending", screen: corpScreen, children: [
        { name: "Beneficial owner", type: "person", pct: 70, jur: s.nationality, flag, role: "Ultimate beneficial owner", kyc: "verified", screen: uboScreen },
        { name: "Nominee Services Ltd", type: "entity", pct: 30, jur: "Jersey", flag: "🇯🇪", role: "Nominee shareholder", kyc: "pending", screen: "review" },
      ] },
    ],
  };
}
export function ownStats(o: Ownership) {
  let entities = 0, ubos = 0, flags = 0, depth = 0;
  (function walk(ns: OwnerNode[], parentFrac: number, lvl: number) {
    depth = Math.max(depth, lvl);
    for (const n of ns) {
      if (n.type === "entity") entities++;
      const eff = parentFrac * (n.pct / 100);
      if (n.type === "person" && eff >= 0.25) ubos++;
      if (n.screen === "pep" || n.screen === "adverse") flags++;
      if (n.children) walk(n.children, eff, lvl + 1);
    }
  })(o.tree, 1, 1);
  return { entities: entities + 1, ubos, flags, depth };
}

/* ── KYB record ────────────────────────────────────────────────────── */
export function kybRecord(s: Sub) {
  const o = ownershipFor(s);
  const j = jurById(s.jurisdictionId);
  return {
    legalName: s.company,
    regNo: o?.regNo ?? "REG " + (120000 + (hash(s.ref) * 317) % 780000),
    type: o?.type ?? `Private company · ${j.name}`,
    incorporated: "20" + (18 + (hash(s.ref) % 7)) + "-0" + (1 + (hash(s.ref) % 9)) + "-14",
    address: `${j.flag} ${j.name}`,
    activity: "Corporate & advisory services",
    directors: [{ name: s.name, role: "Director & shareholder", appointed: "Incorporation" }],
    lastFiling: "2026-04-30", lastFilingType: "Annual return",
    registry: `${j.name} company registry`,
    retrieved: "2026-06-21",
  };
}

/* ── AI screening (collapses raw hits to true matches) ─────────────── */
export type AiMatch = { name: string; jur: string; list: string; score: number; sev: "high" | "medium" | "low"; ref: string; type: "person" | "entity"; reason: string; dismissed: number; sources: string[] };
function aiHits(ref: string) { return 11 + (hash(ref) % 9) * 3; }
function aiMk(name: string, jur: string, list: string, score: number, ref: string, type: "person" | "entity"): AiMatch {
  const sev: AiMatch["sev"] = score >= 85 ? "high" : score >= 72 ? "medium" : "low";
  const reason = ({
    PEP: "Strong name and date-of-birth alignment with a politically-exposed person via a state-linked board seat. Jurisdiction and known associates corroborate the match.",
    "Adverse media": "Multiple credible outlets link this subject to the named entity in the same role and period. Outlier and low-relevance articles were down-weighted.",
  } as Record<string, string>)[list] ?? "AI cross-checked identifiers against the candidate list entry.";
  return { name, jur, list, score: Math.min(97, score), sev, ref, type, reason,
    dismissed: Math.max(0, Math.round(score / 9) + (name.length % 5)),
    sources: list === "Adverse media" ? ["ComplyAdvantage", "Reuters", "Local registry"] : ["ComplyAdvantage", "PEP register"] };
}
export function aiScreen(subs: Sub[]) {
  let entities = 0, people = 0, subsidiaries = 0, raw = 0, structures = 0;
  const matches: AiMatch[] = [];
  for (const x of subs) {
    entities++; raw += aiHits(x.ref);
    const r = amlResult(x.ref);
    if (r.pep === "match") matches.push(aiMk(x.name, x.nationality, "PEP", 88 + (hash(x.ref) % 9), x.ref, "person"));
    if (r.adverse === "flag") matches.push(aiMk(x.name, x.nationality, "Adverse media", 71 + (hash(x.ref) % 12), x.ref, "person"));
    const o = ownershipFor(x);
    if (o) { structures++; (function walk(ns: OwnerNode[]) { for (const n of ns) { entities++; raw += aiHits(n.name); if (n.type === "person") people++; else subsidiaries++; if (n.screen === "pep") matches.push(aiMk(n.name, n.jur, "PEP", 82 + (n.name.length % 10), x.ref, n.type)); if (n.screen === "adverse") matches.push(aiMk(n.name, n.jur, "Adverse media", 76 + (n.name.length % 9), x.ref, n.type)); if (n.children) walk(n.children); } })(o.tree); }
  }
  return { entities, applicants: subs.length, people, subsidiaries, structures, raw, matches };
}

/* ── Client risk score ─────────────────────────────────────────────── */
const RISK_HIGH_JUR: Record<string, number> = { bvi: 1, ky: 1, im: 1, gi: 1, ae: 1, hk: 1 };
const RISK_MED_JUR: Record<string, number> = { ch: 1, sg: 1, uk: 1 };
export const riskBandFor = (score: number) => (score >= 60 ? "high" : score >= 34 ? "medium" : "low");
export type RiskDriver = { key: string; label: string; ic: string; pts: number; max: number; detail: string };
export type Risk = { ref: string; name: string; company: string; score: number; band: "high" | "medium" | "low"; drivers: RiskDriver[]; top: RiskDriver };
export function riskScore(s: Sub): Risk {
  const j = jurById(s.jurisdictionId);
  const jp = RISK_HIGH_JUR[s.jurisdictionId] ? 30 : RISK_MED_JUR[s.jurisdictionId] ? 18 : !j.eu ? 15 : 8;
  const np = s.nonEU ? 18 : 6;
  const o = ownershipFor(s);
  let depth = 0, entities = 0;
  if (o) { const st = ownStats(o); entities = st.entities; depth = st.depth; }
  const cp = o ? Math.min(25, 8 + depth * 4 + Math.max(0, entities - 1) * 3) : s.company !== "—" ? 9 : 3;
  const a = amlResult(s.ref);
  let scp = 0; if (a.sanctions === "match") scp += 25; if (a.pep === "match") scp += 12; if (a.adverse === "flag") scp += 13; scp = Math.min(25, scp);
  const comp = s.completeness ?? "med";
  const dp = ({ low: 15, med: 8, high: 3 } as Record<string, number>)[comp] ?? 8;
  const drivers: RiskDriver[] = [
    { key: "jur", label: "Jurisdiction risk", ic: "globe", pts: jp, max: 30, detail: `${j.flag} ${j.name} — ${RISK_HIGH_JUR[s.jurisdictionId] ? "high-risk rating" : RISK_MED_JUR[s.jurisdictionId] ? "elevated rating" : j.eu ? "EU member, low rating" : "non-EU jurisdiction"} (country-risk feed).` },
    { key: "nat", label: "Cross-border nationality", ic: "passport", pts: np, max: 20, detail: `${s.nationality} — ${s.nonEU ? "non-EU national, enhanced KYC applies" : "EU/EEA national, standard KYC"}.` },
    { key: "struct", label: "Ownership complexity", ic: "sitemap", pts: cp, max: 25, detail: o ? `${entities}-entity structure, ${depth} layer${depth === 1 ? "" : "s"} deep` : s.company !== "—" ? "Corporate applicant, single layer" : "Individual applicant, no structure" },
    { key: "screen", label: "Screening exposure", ic: "shield", pts: scp, max: 25, detail: scp === 0 ? "No sanctions, PEP or adverse-media hits." : [a.sanctions === "match" ? "sanctions" : "", a.pep === "match" ? "PEP" : "", a.adverse === "flag" ? "adverse media" : ""].filter(Boolean).join(" + ") + " match flagged." },
    { key: "docs", label: "Documentation gaps", ic: "documents", pts: dp, max: 15, detail: ({ low: "Low completeness — key documents outstanding", med: "Partial documentation on file", high: "Documentation complete and verified" } as Record<string, string>)[comp] ?? "Partial documentation on file" },
  ];
  const raw = jp + np + cp + scp + dp;
  const score = Math.max(0, Math.min(100, Math.round((raw / 115) * 100)));
  const top = drivers.slice().sort((p, q) => q.pts / q.max - p.pts / p.max)[0];
  return { ref: s.ref, name: s.name, company: s.company, score, band: riskBandFor(score), drivers, top };
}

/* ── Compliance calendar obligations (approved clients) ─────────────── */
export function complianceItems(subs: Sub[]) {
  const out: { kind: string; ic: string; company: string; client: string; daysLeft: number; status: "overdue" | "due-soon" | "upcoming" | "done"; detail: string }[] = [];
  subs.forEach((c, i) => {
    const company = c.company !== "—" ? c.company : c.name;
    out.push({ kind: "KYC expiry", ic: "passport", company, client: c.name, daysLeft: [18, 72, 140][i % 3], status: (["overdue", "due-soon", "upcoming"] as const)[i % 3], detail: "Passport / ID approaching expiry" });
    out.push({ kind: "UBO submission", ic: "users", company, client: c.name, daysLeft: 80 + i * 10, status: i % 2 ? "done" : "upcoming", detail: "Annual UBO register confirmation" });
    out.push({ kind: "Annual return", ic: "building", company, client: c.name, daysLeft: 150 + i * 5, status: "upcoming", detail: "Annual return filing (HE32)" });
  });
  return out;
}
