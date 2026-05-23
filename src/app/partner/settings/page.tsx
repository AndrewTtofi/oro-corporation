import { PartnerShell } from "@/components/admin/PartnerShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { SettingsForms } from "@/app/app/settings/SettingsForms";

export const metadata = { title: "Settings" };

export default async function PartnerSettings() {
  const user = await requireRole("partner");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  return (
    <PartnerShell active="settings">
      <div className="max-w-[680px]">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-meta text-admin-muted mb-8">Update your profile and password.</p>
        <SettingsForms
          initial={{
            fullName: dbUser?.fullName ?? "",
            email: dbUser?.email ?? "",
            phone: dbUser?.phone ?? "",
            languagePref: dbUser?.languagePref ?? "en",
          }}
        />
      </div>
    </PartnerShell>
  );
}
