/* =====================================================================
   Prospect intelligence — completeness scoring + AI-style internal brief.
   Template-based (no external LLM); deterministic so the queue and the brief
   always agree. Works off the prospect's flat answer map + document count.
   ===================================================================== */

export type Completeness = "low" | "med" | "high";

type Answers = Record<string, unknown>;

/** Flatten ProspectDetail rows into a single { field: value } map. */
export function detailsToMap(details: { fieldName: string; fieldValue: string }[]): Answers {
  const m: Answers = {};
  for (const d of details) m[d.fieldName] = d.fieldValue;
  return m;
}

const SERVICE_SPECIFIC_KEYS = [
  "proposedCompanyName", "businessActivity", "shareholderCount", "nomineeServices",
  "currentTaxResidency", "daysInCyprus60Plus", "employmentStatus",
  "permitType", "familyCount", "hasCyprusCompany", "cyprusCompanyRegNumber",
  "accountingSoftware", "monthlyTxVolume", "accountPurpose", "expectedMonthlyVolume",
  "counterpartCountries", "licenseType", "currentJurisdiction", "existingLicenses",
];

function filled(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

/** Mirrors the prototype's calcCompleteness, mapped onto the real schema. */
export function computeCompleteness(input: {
  services: string[];
  answers: Answers;
  docCount: number;
}): Completeness {
  const { services, answers, docCount } = input;
  let score = 0;
  if (services.length >= 1) score += 1;
  if (filled(answers.fullLegalName) && filled(answers.nationality)) score += 1;
  if (typeof answers.businessDescription === "string" && answers.businessDescription.length > 100) score += 1;
  if (filled(answers.timeline) && filled(answers.expectedTurnover)) score += 1;
  const conditionalFilled = SERVICE_SPECIFIC_KEYS.filter((k) => filled(answers[k])).length;
  if (conditionalFilled >= 2) score += 2;
  if (docCount >= 2) score += 2;
  return score <= 3 ? "low" : score <= 6 ? "med" : "high";
}

const SERVICE_LABELS: Record<string, string> = {
  company_formation: "Company Formation",
  accounting: "Accounting & Tax",
  tax_residency: "Tax Residency",
  immigration: "Immigration",
  licensing: "Licensing",
  banking: "Banking",
};

const TURNOVER_LABELS: Record<string, string> = {
  "<50K": "under €50k", "50K-200K": "€50k–€200k", "200K-500K": "€200k–€500k",
  "500K-1M": "€500k–€1m", "1M+": "over €1m",
};
const TIMELINE_LABELS: Record<string, string> = {
  immediately: "immediately", within_1_month: "within 1 month",
  "1_to_3_months": "within 1–3 months", exploring: "just exploring",
};

/** Routing recommendation: senior advisor for licensing or large turnover. */
export function routingFlag(services: string[], answers: Answers): "senior" | "standard" {
  const turnover = String(answers.expectedTurnover ?? "");
  const big = turnover === "500K-1M" || turnover === "1M+";
  return services.includes("licensing") || big ? "senior" : "standard";
}

/** Produces the AI-style internal brief shown to staff on the submission file. */
export function generateBrief(input: {
  fullName: string;
  services: string[];
  answers: Answers;
  docCount: number;
}): string {
  const { fullName, services, answers, docCount } = input;
  const nationality = String(answers.nationality ?? "An applicant");
  const residence = String(answers.residenceCountry ?? answers.currentTaxResidency ?? "an undisclosed jurisdiction");
  const svcList = services.length
    ? services.map((s) => SERVICE_LABELS[s] ?? s).join(", ")
    : "general corporate services";
  const intent = String(answers.businessDescription ?? "—");
  const turnover = TURNOVER_LABELS[String(answers.expectedTurnover ?? "")] ?? "an unstated turnover";
  const timeline = TIMELINE_LABELS[String(answers.timeline ?? "")] ?? "an unstated timeline";
  const route = routingFlag(services, answers) === "senior"
    ? "route to a senior advisor"
    : "suitable for a standard advisor";

  return (
    `${nationality} national (${fullName}) seeking ${svcList} with residence/operations in ${residence}. ` +
    `Stated intent: ${intent} ` +
    `Expected turnover ${turnover}, target timeline ${timeline}. ` +
    `KYC: ${docCount} document(s) on file. Recommendation: ${route}.`
  );
}

export const COMPLETENESS_LABEL: Record<Completeness, string> = { low: "Low", med: "Medium", high: "High" };
