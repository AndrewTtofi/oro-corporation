import { describe, it, expect } from "vitest";
import { diffHitsForAlert, type HitSummary } from "../hit-dedup";

const h = (externalId: string, topics: string[]): HitSummary => ({ externalId, topics });

describe("diffHitsForAlert", () => {
  it("no previous run -> alerts if any current hit", () => {
    expect(diffHitsForAlert(null, [h("A", ["sanction"])])).toBe(true);
    expect(diffHitsForAlert(null, [])).toBe(false);
  });
  it("alerts on a new externalId", () => {
    expect(diffHitsForAlert([h("A", ["role.pep"])], [h("A", ["role.pep"]), h("B", ["sanction"])])).toBe(true);
  });
  it("alerts on a new topic for an existing externalId", () => {
    expect(diffHitsForAlert([h("A", ["role.pep"])], [h("A", ["role.pep", "sanction"])])).toBe(true);
  });
  it("does NOT alert when current is subset of previous", () => {
    expect(diffHitsForAlert([h("A", ["role.pep", "sanction"])], [h("A", ["role.pep"])])).toBe(false);
  });
  it("does NOT alert when identical", () => {
    expect(diffHitsForAlert([h("A", ["role.pep"]), h("B", [])], [h("A", ["role.pep"]), h("B", [])])).toBe(false);
  });
});
