import { AdminShell } from "@/components/admin/AdminShell";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  // Settings is the platform admin's area only; staff are redirected away.
  await requireSuperAdmin();
  return (
    <AdminShell active="settings">
      <div className="mb-6">
        <div className="eyebrow mb-2">SETTINGS</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Settings</h2>
        <p className="muted mt-1" style={{ fontSize: "var(--fs-sm)" }}>Organization-wide configuration.</p>
      </div>
      <SettingsNav />
      {children}
    </AdminShell>
  );
}
