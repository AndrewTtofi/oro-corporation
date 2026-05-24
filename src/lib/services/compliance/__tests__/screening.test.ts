import { describe, it, expect, vi, beforeEach } from "vitest";
import { __setScreeningProviderForTests } from "@/lib/providers/screening";
import type { ScreeningProvider, ScreeningResult } from "@/lib/providers/screening";

// Mock @/lib/db with an in-memory stub.
const db = vi.hoisted(() => {
  const screeningRuns: any[] = [];
  const kycCases = new Map<string, any>();
  const hits: any[] = [];
  return {
    screeningRuns, kycCases, hits,
    seed(id: string, party: any) {
      kycCases.set(id, { id, party, state: "in_progress", latestScreeningRunId: null });
    },
    reset() { screeningRuns.length = 0; hits.length = 0; kycCases.clear(); },
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    kycCase: {
      findUnique: async ({ where: { id } }: any) => db.kycCases.get(id) ?? null,
      update: async ({ where: { id }, data }: any) => {
        const c = db.kycCases.get(id);
        Object.assign(c, data);
        return c;
      },
    },
    screeningRun: {
      create: async ({ data, include }: any) => {
        const run = { id: `run-${db.screeningRuns.length + 1}`, ...data, hits: [] };
        db.screeningRuns.push(run);
        return run;
      },
    },
    screeningHit: {
      createMany: async ({ data }: any) => {
        db.hits.push(...data);
        return { count: data.length };
      },
    },
    activityLog: {
      create: async () => null,
    },
    $transaction: async (fn: any) => fn(this),
  },
}));

import { runScreening } from "../screening";

beforeEach(() => { db.reset(); });

function provider(result: ScreeningResult): ScreeningProvider {
  return { name: "stub", match: vi.fn().mockResolvedValue(result) };
}

describe("runScreening", () => {
  it("writes a clear ScreeningRun and updates kyc.latestScreeningRunId", async () => {
    db.seed("k1", { type: "individual", fullName: "Jane", dateOfBirth: null, nationality: "CY" });
    __setScreeningProviderForTests(provider({ outcome: "clear", hits: [], raw: {} }));
    const run = await runScreening("k1", { actorId: null });
    expect(run.outcome).toBe("clear");
    expect(db.kycCases.get("k1").latestScreeningRunId).toBe(run.id);
    expect(db.hits).toHaveLength(0);
  });

  it("persists hits when provider returns matches", async () => {
    db.seed("k1", { type: "individual", fullName: "Joe", dateOfBirth: null, nationality: "CY" });
    __setScreeningProviderForTests(provider({
      outcome: "hits",
      hits: [{ externalId: "NK-1", matchedName: "Joe", matchedSchema: "Person", matchedTopics: ["sanction"], matchScore: 0.9, matchedListings: [], matchUrl: "u" }],
      raw: {},
    }));
    const run = await runScreening("k1", { actorId: null });
    expect(run.outcome).toBe("hits");
    expect(run.hitCount).toBe(1);
    expect(db.hits).toHaveLength(1);
  });

  it("on provider error: writes ScreeningRun with outcome=error and does NOT change kyc state", async () => {
    db.seed("k1", { type: "individual", fullName: "Joe", dateOfBirth: null, nationality: "CY" });
    db.kycCases.get("k1").state = "passed";
    __setScreeningProviderForTests(provider({ outcome: "error", hits: [], errorMessage: "boom" }));
    const run = await runScreening("k1", { actorId: null });
    expect(run.outcome).toBe("error");
    expect(db.kycCases.get("k1").state).toBe("passed");
  });
});
