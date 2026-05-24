import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

export function AdminClientShell({ breadcrumb, children }: { breadcrumb: string; children: React.ReactNode }) {
  return (
    <AdminShell
      active="clients"
      topRight={
        <div className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold" style={{ background: "var(--accent)", color: "var(--dark)" }}>
          JD
        </div>
      }
    >
      <nav className="text-[13px] text-admin-muted flex items-center gap-2 mb-6">
        <Link href="/admin/clients" className="text-accent font-medium">Clients</Link>
        <span>/</span>
        <span className="text-admin-fg font-semibold">{breadcrumb}</span>
      </nav>
      {children}
    </AdminShell>
  );
}
