import type { DocPurpose } from "@prisma/client";

export const BUCKET_KYC = "__kyc__" as const;
export const BUCKET_CORRESPONDENCE = "__correspondence__" as const;

export interface BucketInput {
  purpose: DocPurpose;
  partyId: string | null;
  serviceTypeKey: string | null;
}

/**
 * Returns the folder identifier this document should render under on the
 * client page. Returns either:
 *  - BUCKET_KYC (KYC Documents folder)
 *  - BUCKET_CORRESPONDENCE (general / un-bucketed)
 *  - a Service.key string (e.g. "company_formation")
 */
export function bucketDocument(d: BucketInput): string {
  if (d.purpose === "passport" || d.purpose === "proof_of_address" || d.purpose === "sof") {
    return BUCKET_KYC;
  }
  if (d.serviceTypeKey) return d.serviceTypeKey;
  return BUCKET_CORRESPONDENCE;
}
