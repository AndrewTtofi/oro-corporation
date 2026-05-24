import { describe, it, expect } from "vitest";
import { countryRisk } from "../data/country-risk";

describe("countryRisk", () => {
  it("returns 0 for low-risk (CY)", () => {
    expect(countryRisk("CY")).toBe(0);
  });
  it("returns 3 for FATF-blacklisted (KP)", () => {
    expect(countryRisk("KP")).toBe(3);
  });
  it("returns 3 for IR (Iran)", () => {
    expect(countryRisk("IR")).toBe(3);
  });
  it("defaults to 1 for unknown codes", () => {
    expect(countryRisk("ZZ")).toBe(1);
  });
  it("is case-insensitive", () => {
    expect(countryRisk("kp")).toBe(3);
  });
  it("returns 0 for null/empty input", () => {
    expect(countryRisk(null)).toBe(0);
    expect(countryRisk("")).toBe(0);
  });
});
