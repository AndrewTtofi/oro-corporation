import { describe, it, expect } from "vitest";
import { bucketDocument, BUCKET_KYC, BUCKET_CORRESPONDENCE } from "../documents-bucket";

const d = (over: Partial<Parameters<typeof bucketDocument>[0]>) => bucketDocument({
  purpose: "other", partyId: null, serviceTypeKey: null, ...over,
});

describe("bucketDocument", () => {
  it("returns KYC when purpose is passport/POA/SOF", () => {
    expect(d({ purpose: "passport" })).toBe(BUCKET_KYC);
    expect(d({ purpose: "proof_of_address" })).toBe(BUCKET_KYC);
    expect(d({ purpose: "sof" })).toBe(BUCKET_KYC);
  });
  it("returns the service key when present and purpose is other", () => {
    expect(d({ purpose: "other", serviceTypeKey: "company_formation" })).toBe("company_formation");
  });
  it("KYC purpose wins over serviceTypeKey", () => {
    expect(d({ purpose: "passport", serviceTypeKey: "company_formation" })).toBe(BUCKET_KYC);
  });
  it("falls back to correspondence", () => {
    expect(d({ purpose: "other", serviceTypeKey: null })).toBe(BUCKET_CORRESPONDENCE);
  });
});
