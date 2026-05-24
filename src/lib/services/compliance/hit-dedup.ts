export interface HitSummary {
  externalId: string;
  topics: string[];
}

/** Returns true if the current run contains a hit (or topic) not seen in the
 *  previous run. Drives whether ongoing monitoring opens a ReviewTask. */
export function diffHitsForAlert(previous: HitSummary[] | null, current: HitSummary[]): boolean {
  if (!previous) return current.length > 0;
  const prev = new Map(previous.map((h) => [h.externalId, new Set(h.topics)]));
  for (const cur of current) {
    const prevTopics = prev.get(cur.externalId);
    if (!prevTopics) return true;
    for (const t of cur.topics) {
      if (!prevTopics.has(t)) return true;
    }
  }
  return false;
}
