import { getOrgSettings } from "@/lib/services/settings";
import { OrgForm } from "./OrgForm";

export const metadata = { title: "Organization · Settings" };
export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const org = await getOrgSettings();
  return (
    <OrgForm
      initial={{
        displayName: org.displayName,
        contactEmail: org.contactEmail,
        address: org.address,
        documentsPhase:
          org.documentsPhase === "optional" || org.documentsPhase === "off"
            ? org.documentsPhase
            : "mandatory",
      }}
    />
  );
}
