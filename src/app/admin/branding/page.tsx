import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/services/settings";
import { BrandIdentityForm } from "./BrandIdentityForm";

export const metadata = { title: "Branding" };
export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  await requireRole("staff");
  const org = await getOrgSettings();
  return (
    <AdminShell active="branding">
      <div className="mb-6">
        <div className="eyebrow mb-2">Firm identity</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Branding</h2>
        <p className="muted mt-1" style={{ fontSize: "var(--fs-sm)" }}>
          Upload your firm&apos;s logo and set its name — applied across the client portal, login and public site.
          Theme colours and plan are managed by your platform provider.
        </p>
      </div>
      <BrandIdentityForm
        initial={{
          brandName: org.brandName ?? org.displayName ?? "",
          brandMark: org.brandMark ?? "",
          logo: org.logo ?? "",
        }}
      />
    </AdminShell>
  );
}
