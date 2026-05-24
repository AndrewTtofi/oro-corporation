import { z } from "zod";

export const SERVICE_KEYS = [
  "company_formation",
  "accounting",
  "tax_residency",
  "immigration",
  "licensing",
  "banking",
] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

/** Step 1 — minimum 1 service required. */
export const serviceSelectionSchema = z.object({
  services: z.array(z.enum(SERVICE_KEYS)).min(1, "Select at least one service"),
});

/** Step 2 — always-shown qualification block. */
export const personalAndIntentSchema = z.object({
  fullLegalName: z.string().min(2).max(150),
  dateOfBirth: z.coerce.date().refine((d) => d < new Date(), "Must be in the past"),
  nationality: z.string().min(2),
  residenceCountry: z.string().min(2),
  address: z.string().min(8).max(500),
  businessDescription: z
    .string()
    .min(100, "Please describe your business in at least 100 characters"),
  expectedTurnover: z.enum([
    "<50K",
    "50K-200K",
    "200K-500K",
    "500K-1M",
    "1M+",
  ]),
  timeline: z.enum(["immediately", "within_1_month", "1_to_3_months", "exploring"]),
  source: z.enum(["google", "referral", "social", "event", "other"]),
});

/** Step 2 — conditional fields per service. All optional at the type level;
    runtime validation widens to required when the relevant service is selected. */
export const serviceSpecificsSchema = z.object({
  // Company Formation
  proposedCompanyName: z.string().optional(),
  businessActivity: z.string().optional(),
  shareholderCount: z.coerce.number().int().min(1).optional(),
  nomineeServices: z.boolean().optional(),

  // Tax Residency
  currentTaxResidency: z.string().optional(),
  daysInCyprus60Plus: z.boolean().optional(),
  employmentStatus: z.string().optional(),

  // Immigration
  permitType: z.enum(["work", "pr", "digital_nomad"]).optional(),
  familyCount: z.coerce.number().int().min(0).optional(),

  // Accounting
  hasCyprusCompany: z.boolean().optional(),
  cyprusCompanyRegNumber: z.string().optional(),
  accountingSoftware: z.string().optional(),
  monthlyTxVolume: z.string().optional(),

  // Banking
  accountPurpose: z.string().optional(),
  expectedMonthlyVolume: z.string().optional(),
  counterpartCountries: z.string().optional(),

  // Licensing
  licenseType: z.string().optional(),
  currentJurisdiction: z.string().optional(),
  existingLicenses: z.string().optional(),
});

export const fullDraftSchema = personalAndIntentSchema.partial().merge(serviceSpecificsSchema).extend({
  services: z.array(z.enum(SERVICE_KEYS)).optional(),
});

export const submitSchema = personalAndIntentSchema.merge(serviceSpecificsSchema).extend({
  services: z.array(z.enum(SERVICE_KEYS)).min(1),
});

/** Tightens the conditional fields based on selected services. */
export function refineForSubmit(input: z.infer<typeof submitSchema>) {
  const errors: { field: string; message: string }[] = [];
  if (input.services.includes("company_formation")) {
    if (!input.proposedCompanyName) errors.push({ field: "proposedCompanyName", message: "Required for Company Formation" });
    if (input.shareholderCount === undefined) errors.push({ field: "shareholderCount", message: "Required for Company Formation" });
  }
  if (input.services.includes("tax_residency")) {
    if (!input.currentTaxResidency) errors.push({ field: "currentTaxResidency", message: "Required for Tax Residency" });
    if (input.daysInCyprus60Plus === undefined) errors.push({ field: "daysInCyprus60Plus", message: "Required for Tax Residency" });
  }
  if (input.services.includes("immigration")) {
    if (!input.permitType) errors.push({ field: "permitType", message: "Required for Immigration" });
    if (input.familyCount === undefined) errors.push({ field: "familyCount", message: "Required for Immigration" });
  }
  if (input.services.includes("accounting")) {
    if (input.hasCyprusCompany === undefined) errors.push({ field: "hasCyprusCompany", message: "Required for Accounting" });
  }
  if (input.services.includes("banking")) {
    if (!input.accountPurpose) errors.push({ field: "accountPurpose", message: "Required for Banking" });
  }
  if (input.services.includes("licensing")) {
    if (!input.licenseType) errors.push({ field: "licenseType", message: "Required for Licensing" });
  }
  return errors;
}

export type FullDraft = z.infer<typeof fullDraftSchema>;
export type SubmitInput = z.infer<typeof submitSchema>;
