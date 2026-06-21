import { getOrgSettings } from "@/lib/services/settings";
import { BrandingForm } from "./BrandingForm";

export const metadata = { title: "Branding & plan · Settings" };
export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const org = await getOrgSettings();
  return (
    <BrandingForm
      initial={{
        brandName: org.brandName ?? org.displayName ?? "",
        brandMark: org.brandMark ?? "",
        accentColor: org.accentColor ?? "",
        themePreset: org.themePreset ?? "indigo",
        planTier: org.planTier ?? "professional",
      }}
    />
  );
}
