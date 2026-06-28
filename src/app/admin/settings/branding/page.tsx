import { getOrgSettings } from "@/lib/services/settings";
import { currentIsSuperAdmin } from "@/lib/auth/guards";
import { BrandingForm } from "./BrandingForm";

export const metadata = { title: "Branding & plan · Settings" };
export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const [org, superAdmin] = await Promise.all([getOrgSettings(), currentIsSuperAdmin()]);
  return (
    <BrandingForm
      canEditPlan={superAdmin}
      initial={{
        brandName: org.brandName ?? org.displayName ?? "",
        brandMark: org.brandMark ?? "",
        logo: org.logo ?? "",
        accentColor: org.accentColor ?? "",
        themePreset: org.themePreset ?? "indigo",
        planTier: org.planTier ?? "professional",
      }}
    />
  );
}
