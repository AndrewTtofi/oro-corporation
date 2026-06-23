import { PrismaClient } from "@prisma/client";
import { pgAdapter } from "@/lib/prisma-adapter";

const prisma = new PrismaClient({ adapter: pgAdapter() });

/**
 * Idempotent white-label brand provisioning from env. Runs on every deploy.
 * The firm name is configured ONCE as the `COMPANY_NAME` GitHub Actions
 * variable (the same one the deploy notifier uses) and injected into the box
 * .env by the deploy script — never hard-coded in the app.
 *
 * Sets the singleton OrgSettings.brandName to COMPANY_NAME so the whole app
 * (emails, calendar, UI, reference prefixes, legal pages) renders under the
 * firm's name. No-op when COMPANY_NAME is unset, so existing/UI-customised
 * branding is preserved.
 */
export async function ensureBranding() {
  const name = process.env.COMPANY_NAME?.trim();
  if (!name) { console.log("[branding] COMPANY_NAME not set — leaving branding as-is."); return; }

  const row = await prisma.orgSettings.upsert({
    where: { id: "singleton" },
    update: { brandName: name },
    create: { id: "singleton", brandName: name },
  });
  console.log(`[branding] set brandName="${row.brandName}".`);
}

if (require.main === module) {
  ensureBranding()
    .then(() => console.log("[branding] done."))
    .catch((e) => { console.error("[branding] failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
