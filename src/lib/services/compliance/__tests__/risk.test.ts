import { describe, it, expect } from "vitest";
import { computeRisk, type RiskInput } from "../risk";

function makeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    parties: [],
    expectedTurnover: "<50K",
    businessActivity: "Software consultancy",
    hasNominees: false,
    entityLayers: 1,
    ...overrides,
  };
}

describe("computeRisk", () => {
  it("scores low for clean Cyprus individual", () => {
    const r = computeRisk(makeInput({
      parties: [{ role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null }],
    }));
    expect(r.rating).toBe("low");
    expect(r.score).toBe(0);
  });

  it("forces high when any party in FATF blacklist", () => {
    const r = computeRisk(makeInput({
      parties: [
        { role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null },
        { role: "ubo",          isPep: false, nationality: "KP", countryOfResidence: "CY", jurisdiction: null },
      ],
    }));
    expect(r.rating).toBe("high");
    expect(r.factors.forcedHigh).toBe(true);
  });

  it("bumps PEP score when main contact is PEP", () => {
    const r = computeRisk(makeInput({
      parties: [{ role: "main_contact", isPep: true, nationality: "CY", countryOfResidence: "CY", jurisdiction: null }],
    }));
    expect(r.factors.pep).toBe(3);
  });

  it("standard band for greylisted-country UBO + low turnover", () => {
    const r = computeRisk(makeInput({
      parties: [
        { role: "main_contact", isPep: false, nationality: "GB", countryOfResidence: "GB", jurisdiction: null },
        { role: "ubo",          isPep: false, nationality: "AE", countryOfResidence: "AE", jurisdiction: null },
      ],
      expectedTurnover: "200K-500K",
    }));
    expect(r.rating).toBe("standard");
    expect(r.factors.geo).toBeGreaterThanOrEqual(2);
  });

  it("high band for crypto + 1M+ turnover", () => {
    const r = computeRisk(makeInput({
      parties: [{ role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null }],
      businessActivity: "Cryptocurrency exchange",
      expectedTurnover: "1M+",
    }));
    expect(r.rating).toBe("high");
    expect(r.factors.industry).toBe(3);
    expect(r.factors.turnover).toBe(3);
  });

  it("nominees + many parties push complexity", () => {
    const parties = Array.from({ length: 6 }, () => ({
      role: "ubo" as const, isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null,
    }));
    parties.unshift({ role: "main_contact", isPep: false, nationality: "CY", countryOfResidence: "CY", jurisdiction: null });
    const r = computeRisk(makeInput({ parties, hasNominees: true, entityLayers: 3 }));
    expect(r.factors.complexity).toBe(3);
  });
});
