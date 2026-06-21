import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

/**
 * Idempotent provisioning of the platform super-admin account(s) from env.
 * Runs on every deploy. Values come from GitHub secrets, injected into the
 * box .env / passed through by the deploy script:
 *   SUPER_ADMIN_EMAILS    comma-separated emails (the same allowlist the app gates on)
 *   SUPER_ADMIN_PASSWORD  password set when the account is first created
 *
 * Each email becomes a verified `staff` user. An existing account is promoted
 * to staff + verified but its password is left untouched (we never reset a
 * password someone may have changed).
 */
export async function ensureSuperAdmins() {
  const emails = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!emails.length) { console.log("[super-admin] SUPER_ADMIN_EMAILS not set — nothing to provision."); return; }
  if (!password) { console.log("[super-admin] SUPER_ADMIN_PASSWORD not set — cannot create accounts; skipping."); return; }

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const email of emails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: Role.staff, emailVerified: new Date(), deactivatedAt: null },
      create: { email, passwordHash: hash, fullName: "Platform Admin", role: Role.staff, emailVerified: new Date() },
    });
    console.log(`[super-admin] ensured ${email} (id=${user.id}, role=${user.role})`);
  }
}

if (require.main === module) {
  ensureSuperAdmins()
    .then(() => console.log("[super-admin] done."))
    .catch((e) => { console.error("[super-admin] failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
