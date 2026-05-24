import type { ScreeningProvider, ScreeningQuery, ScreeningResult, ProviderHit } from "./screening";

interface Opts {
  apiKey?: string;
  threshold: number;
  endpoint?: string;      // override for tests
  retryDelayMs?: number;  // base for backoff
}

const DEFAULT_ENDPOINT = "https://api.opensanctions.org/match/default";
const MAX_RETRIES = 3;

export class OpenSanctionsProvider implements ScreeningProvider {
  readonly name = "opensanctions";
  private readonly endpoint: string;
  private readonly retryDelayMs: number;

  constructor(private readonly opts: Opts) {
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.retryDelayMs = opts.retryDelayMs ?? 250;
  }

  async match(input: ScreeningQuery): Promise<ScreeningResult> {
    const body = {
      queries: {
        q1: {
          schema: input.schema,
          properties: this.toProperties(input),
        },
      },
    };

    let lastErr = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.opts.apiKey ? { Authorization: `ApiKey ${this.opts.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
        });
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        await wait(this.retryDelayMs * 2 ** attempt);
        continue;
      }
      if (res.ok) {
        const json = (await res.json()) as { responses: Record<string, { results: RawResult[] }> };
        const results = json.responses?.q1?.results ?? [];
        const hits = results
          .filter((r) => (r.score ?? 0) >= this.opts.threshold)
          .map(this.toHit);
        return {
          outcome: hits.length > 0 ? "hits" : "clear",
          hits,
          raw: json,
        };
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        await wait(this.retryDelayMs * 2 ** attempt);
        continue;
      }
      // 4xx other than 429 = unrecoverable
      const errBody = await safeText(res);
      return { outcome: "error", hits: [], errorMessage: `HTTP ${res.status}: ${errBody}` };
    }
    return { outcome: "error", hits: [], errorMessage: lastErr };
  }

  private toProperties(q: ScreeningQuery): Record<string, string[]> {
    const props: Record<string, string[]> = { name: [q.name] };
    if (q.birthDate) props.birthDate = [q.birthDate];
    if (q.nationality) props.nationality = [q.nationality];
    if (q.jurisdiction) props.jurisdiction = [q.jurisdiction];
    if (q.registrationNumber) props.registrationNumber = [q.registrationNumber];
    return props;
  }

  private toHit = (r: RawResult): ProviderHit => ({
    externalId: r.id,
    matchedName: r.caption ?? "",
    matchedSchema: r.schema ?? "",
    matchedTopics: Array.isArray(r.properties?.topics) ? r.properties!.topics! : [],
    matchScore: r.score ?? 0,
    matchedListings: r.datasets ?? [],
    matchUrl: r.id ? `https://www.opensanctions.org/entities/${r.id}/` : undefined,
  });
}

interface RawResult {
  id: string;
  score?: number;
  caption?: string;
  schema?: string;
  properties?: { topics?: string[] };
  datasets?: string[];
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const safeText = async (r: Response): Promise<string> => {
  try { return await r.text(); } catch { return ""; }
};
