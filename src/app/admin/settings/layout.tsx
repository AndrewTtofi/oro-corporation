import { AdminShell } from "@/components/admin/AdminShell";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  // Settings is the platform admin's area only; staff are redirected away.
  await requireSuperAdmin();
  return (
    <AdminShell active="settings">
      <div className="mb-8">
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-meta text-admin-muted mt-1">Organization-wide configuration.</p>
      </div>
      <SettingsNav />
      {children}
    </AdminShell>
  );
}
