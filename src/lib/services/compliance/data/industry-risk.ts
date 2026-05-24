/**
 * Industry risk classification based on FATF + Cyprus AML guidance.
 * Matches by case-insensitive substring against the business-activity free text.
 * Higher-risk keywords win.
 */
const TIERS: { score: 0 | 1 | 2 | 3; keywords: string[] }[] = [
  { score: 3, keywords: ["gambling", "casino", "sportsbook", "betting", "crypto", "digital asset", "virtual asset", "vasp", "arms", "weapons", "defense", "defence", "munitions"] },
  { score: 2, keywords: ["real estate", "precious metals", "diamond", "jewellery", "jewelry", "art dealer", "auction", "money service", "msb", "remittance"] },
  { score: 1, keywords: ["restaurant", "bar ", "nightclub", "car wash", "laundromat", "convenience store", "scrap metal", "second-hand goods"] },
];

export function industryRisk(activity: string | null | undefined): 0 | 1 | 2 | 3 {
  if (!activity) return 0;
  const hay = activity.toLowerCase();
  for (const tier of TIERS) {
    if (tier.keywords.some((kw) => hay.includes(kw))) return tier.score;
  }
  return 0;
}
