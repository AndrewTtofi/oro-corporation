import { env } from "@/lib/env";

export type ScreeningSchema = "Person" | "Organization";

export interface ScreeningQuery {
  schema: ScreeningSchema;
  name: string;
  birthDate?: string;        // ISO YYYY-MM-DD
  nationality?: string;      // ISO 3166-1 alpha-2
  jurisdiction?: string;     // for entities
  registrationNumber?: string;
}

export interface ProviderHit {
  externalId: string;
  matchedName: string;
  matchedSchema: string;
  matchedTopics: string[];
  matchScore: number;
  matchedListings: unknown;
  matchUrl?: string;
}

export interface ScreeningResult {
  outcome: "clear" | "hits" | "error";
  hits: ProviderHit[];
  raw?: unknown;
  errorMessage?: string;
}

export interface ScreeningProvider {
  readonly name: string;
  match(input: ScreeningQuery): Promise<ScreeningResult>;
}

let cached: ScreeningProvider | undefined;

export function screening(): ScreeningProvider {
  if (cached) return cached;
  const driver = env().SCREENING_DRIVER;
  switch (driver) {
    case "opensanctions": {
      // Lazy import so tests can mock without pulling network code.
      const { OpenSanctionsProvider } = require("./screening.opensanctions");
      cached = new OpenSanctionsProvider({
        apiKey: env().OPENSANCTIONS_API_KEY,
        threshold: env().SCREENING_MATCH_THRESHOLD,
      });
      return cached!;
    }
  }
}

/** Test-only: override the provider for the duration of a test. */
export function __setScreeningProviderForTests(p: ScreeningProvider | undefined) {
  cached = p;
}
