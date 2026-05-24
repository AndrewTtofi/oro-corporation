import { z } from "zod";

/**
 * Server-side environment validation. Required keys cause boot to fail loudly.
 * Optional keys (OAuth, Twilio, S3, Resend) are tolerated when their feature is off.
 */
const schema = z.object({
  // Core
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be ≥32 chars"),
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url(),

  // File storage (AES-256-GCM envelope; key is 32 raw bytes encoded base64)
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("/data/docs"),
  ENCRYPTION_KEY_B64: z.string().min(40, "ENCRYPTION_KEY_B64 must be ≥40 base64 chars"),

  // S3 (only when STORAGE_DRIVER=s3)
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().optional(),

  // Email
  EMAIL_DRIVER: z.enum(["smtp", "resend", "console"]).default("smtp"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().optional(),

  // Compliance screening
  SCREENING_DRIVER: z.enum(["opensanctions"]).default("opensanctions"),
  SCREENING_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  OPENSANCTIONS_API_KEY: z.string().optional(),

  // OAuth (gated — off by default per project owner)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // WhatsApp / Twilio (P1, env-gated)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // App behavior
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SEED_ON_BOOT: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // next build's "Collecting page data" phase imports every route to compute
  // static metadata. Routes pull in features/env at module scope, so without
  // this guard the build would require real runtime secrets. Validation still
  // runs at every actual server boot (NEXT_PHASE is unset there).
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return schema.parse({
      DATABASE_URL: "postgresql://build:build@localhost:5432/build",
      AUTH_SECRET: "x".repeat(32),
      APP_URL: "http://localhost",
      ENCRYPTION_KEY_B64: "x".repeat(44),
      NODE_ENV: "production",
    });
  }
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const lines = Object.entries(flat).map(([k, v]) => `  - ${k}: ${v?.join("; ")}`);
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Feature flags derived from env presence — used to gate optional providers. */
export const features = {
  get googleOAuth() { return !!(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET); },
  get linkedinOAuth() { return !!(env().LINKEDIN_CLIENT_ID && env().LINKEDIN_CLIENT_SECRET); },
  get whatsapp() {
    const e = env();
    return !!(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_WHATSAPP_FROM);
  },
  get resendEmail() { return env().EMAIL_DRIVER === "resend" && !!env().RESEND_API_KEY; },
};
