import { countryRisk, FATF_BLACKLISTED } from "./data/country-risk";
import { industryRisk } from "./data/industry-risk";

export type RiskRatingLabel = "low" | "standard" | "high";

export interface PartyInput {
  role: "main_contact" | "ubo" | "director" | "shareholder" | "signatory" | "intermediary";
  isPep: boolean;
  nationality: string | null;
  countryOfResidence: string | null;
  jurisdiction: string | null;
}

export interface RiskInput {
  parties: PartyInput[];
  expectedTurnover: "<50K" | "50K-200K" | "200K-500K" | "500K-1M" | "1M+";
  businessActivity: string | null;
  hasNominees: boolean;
  entityLayers: number;
}

export interface RiskFactors {
  geo: 0 | 1 | 2 | 3;
  pep: 0 | 1 | 2 | 3;
  industry: 0 | 1 | 2 | 3;
  complexity: 0 | 1 | 2 | 3;
  turnover: 0 | 1 | 2 | 3;
  forcedHigh: boolean;
}

export interface RiskResult {
  score: number;
  rating: RiskRatingLabel;
  factors: RiskFactors;
}

const TURNOVER: Record<RiskInput["expectedTurnover"], 0 | 1 | 2 | 3> = {
  "<50K":      0,
  "50K-200K":  1,
  "200K-500K": 1,
  "500K-1M":   2,
  "1M+":       3,
};

export function computeRisk(input: RiskInput): RiskResult {
  const geoCandidates = input.parties.flatMap((p) =>
    [p.nationality, p.countryOfResidence, p.jurisdiction].map(countryRisk),
  );
  const geo = (geoCandidates.length ? Math.max(...geoCandidates) : 0) as 0 | 1 | 2 | 3;

  const forcedHigh = input.parties.some((p) =>
    [p.nationality, p.countryOfResidence, p.jurisdiction]
      .filter(Boolean)
      .some((code) => FATF_BLACKLISTED.has(String(code).toUpperCase())),
  );

  const anyPep = input.parties.some((p) => p.isPep);
  const mainPep = input.parties.some((p) => p.role === "main_contact" && p.isPep);
  const pep: 0 | 1 | 2 | 3 = mainPep ? 3 : anyPep ? 2 : 0;

  const industry = industryRisk(input.businessActivity);

  let complexity: 0 | 1 | 2 | 3 = 0;
  if (input.parties.length > 5) complexity = 2;
  else if (input.parties.length > 2) complexity = 1;
  if (input.hasNominees) complexity = Math.min(3, complexity + 1) as 0 | 1 | 2 | 3;
  if (input.entityLayers >= 3) complexity = 3;

  const turnover = TURNOVER[input.expectedTurnover];

  const score = geo + pep + industry + complexity + turnover;
  let rating: RiskRatingLabel = score <= 2 ? "low" : score <= 5 ? "standard" : "high";
  if (forcedHigh) rating = "high";

  return { score, rating, factors: { geo, pep, industry, complexity, turnover, forcedHigh } };
}
