import { describe, it, expect } from "vitest";
import { industryRisk } from "../data/industry-risk";

describe("industryRisk", () => {
  it("returns 3 for gambling keywords", () => {
    expect(industryRisk("Online casino & sportsbook operator")).toBe(3);
  });
  it("returns 3 for crypto/digital-asset keywords", () => {
    expect(industryRisk("Crypto exchange and OTC trading desk")).toBe(3);
  });
  it("returns 3 for arms keywords", () => {
    expect(industryRisk("Defense and weapons procurement consultancy")).toBe(3);
  });
  it("returns 2 for real-estate / precious-metals", () => {
    expect(industryRisk("Real estate brokerage")).toBe(2);
    expect(industryRisk("Precious metals trading")).toBe(2);
  });
  it("returns 1 for cash-intensive (restaurant / car wash)", () => {
    expect(industryRisk("Restaurant operator")).toBe(1);
  });
  it("returns 0 for default professional services", () => {
    expect(industryRisk("Software consultancy")).toBe(0);
  });
  it("handles empty input", () => {
    expect(industryRisk("")).toBe(0);
    expect(industryRisk(null)).toBe(0);
  });
});
