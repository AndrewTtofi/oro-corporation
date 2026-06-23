import argon2 from "argon2";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { email } from "@/lib/providers/email";
import { getServerBranding } from "@/lib/services/branding-server";
import { env } from "@/lib/env";
import { registerSchema, type RegisterInput, forgotSchema, resetSchema } from "@/lib/schema/auth";

const TOKEN_BYTES = 32;

function makeToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(t: string) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

/**
 * Registers a new prospect. Email verification is mandatory; the verification
 * link uses a stored *hashed* token (raw token only ever in the email).
 */
export async function registerProspect(input: RegisterInput) {
  const parsed = registerSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) {
    // Generic message — do not leak existence.
    return { ok: false as const, reason: "EXISTS" as const };
  }

  const passwordHash = await argon2.hash(parsed.password, { type: argon2.argon2id });

  const rawToken = makeToken();
  const hashed = hashToken(rawToken);

  // In dev, skip the email round-trip — auto-verify so the user can sign in
  // immediately. Production still requires clicking the link.
  const autoVerify = env().NODE_ENV === "development";

  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      passwordHash,
      fullName: parsed.fullName,
      phone: `${parsed.phoneCountry}${parsed.phoneNumber}`,
      role: Role.prospect,
      ...(autoVerify ? { emailVerified: new Date() } : {}),
      verificationTokens: {
        create: {
          token: hashed,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const link = `${env().APP_URL}/verify/${rawToken}`;
  const { legalName } = await getServerBranding();
  await email().send({
    to: user.email,
    subject: `Verify your ${legalName} account`,
    html: `<p>Welcome, ${user.fullName}.</p>
           <p>Please confirm your email by clicking the link below. It expires in 24 hours.</p>
           <p><a href="${link}">${link}</a></p>`,
  });

  return { ok: true as const, userId: user.id };
}

/**
 * Validates a verification token from the email link. One-shot — deletes
 * matching tokens (and any older ones for the same user) on success.
 */
export async function verifyEmailByToken(rawToken: string) {
  const hashed = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { token: hashed } });
  if (!record) return { ok: false as const, reason: "INVALID" as const };
  if (record.expires < new Date()) return { ok: false as const, reason: "EXPIRED" as const };

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true as const };
}

/**
 * Forgot-password: always returns ok=true to avoid email enumeration. Real
 * delivery happens only when the email is on file.
 */
export async function startPasswordReset(rawEmail: string) {
  const parsed = forgotSchema.safeParse({ email: rawEmail });
  if (!parsed.success) return { ok: true as const };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return { ok: true as const };

  const rawToken = makeToken();
  const hashed = hashToken(rawToken);
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: hashed,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const link = `${env().APP_URL}/reset/${rawToken}`;
  const { legalName } = await getServerBranding();
  await email().send({
    to: user.email,
    subject: `Reset your ${legalName} password`,
    html: `<p>You requested a password reset.</p>
           <p>Use the link below within 1 hour. If you did not request this, ignore this email.</p>
           <p><a href="${link}">${link}</a></p>`,
  });

  return { ok: true as const };
}

export async function completePasswordReset(input: { token: string; password: string }) {
  const parsed = resetSchema.parse(input);
  const hashed = hashToken(parsed.token);
  const record = await prisma.passwordReset.findUnique({ where: { token: hashed } });
  if (!record) return { ok: false as const, reason: "INVALID" as const };
  if (record.expires < new Date() || record.usedAt) return { ok: false as const, reason: "EXPIRED" as const };

  const passwordHash = await argon2.hash(parsed.password, { type: argon2.argon2id });
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true as const };
}
