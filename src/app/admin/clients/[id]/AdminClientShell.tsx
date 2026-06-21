import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

export function AdminClientShell({
  breadcrumb,
  children,
}: {
  breadcrumb: string;
  children: React.ReactNode;
}) {
  return (
    <AdminShell active="clients">
      <nav className="row gap-3 mb-8 eyebrow">
        <Link href="/admin/clients" className="link-gold muted">
          Clients
        </Link>
        <span className="muted">/</span>
        <span className="truncate" style={{ maxWidth: "420px" }}>{breadcrumb}</span>
      </nav>
      {children}
    </AdminShell>
  );
}
