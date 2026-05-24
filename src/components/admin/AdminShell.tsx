import Link from "next/link";
import { signOut } from "@/lib/auth";

type AdminTab = "submissions" | "bookings" | "clients" | "users" | "compliance" | "analytics" | "content" | "settings";

export function AdminShell({
  children,
  active,
  search,
  topRight,
}: {
  children: React.ReactNode;
  active: AdminTab;
  search?: { placeholder: string };
  topRight?: React.ReactNode;
}) {
  return (
    <div className="shell-admin min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="bg-dark text-white p-6 hidden lg:flex flex-col gap-10">
        <div className="font-display text-lg font-semibold tracking-wider text-accent">ORO ADMIN</div>
        <nav className="flex flex-col gap-1">
          <NavLink href="/admin/submissions" label="Submissions" active={active === "submissions"} />
          <NavLink href="/admin/bookings" label="Bookings" active={active === "bookings"} />
          <NavLink href="/admin/clients" label="Clients" active={active === "clients"} />
          <NavLink href="/admin/users" label="Users" active={active === "users"} />
          <NavLink href="/admin/compliance/tasks" label="Compliance" active={active === "compliance"} />
          <NavLink href="/admin/analytics" label="Analytics" active={active === "analytics"} />
          <NavLink href="/admin/content" label="Content" active={active === "content"} />
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink href="/admin/settings" label="Settings" active={active === "settings"} />
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-inner text-meta font-medium text-[#ef4444] hover:bg-white/5">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-col min-w-0">
        <header className="h-16 bg-admin-surface border-b border-admin-border flex items-center justify-between px-8 shrink-0">
          {search ? (
            <input
              className="rounded-inner px-3 py-2 text-[13px] w-[320px]"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
              placeholder={search.placeholder}
            />
          ) : <span />}
          {topRight ?? (
            <div className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold bg-accent text-dark">
              JD
            </div>
          )}
        </header>
        <main className="p-8 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-inner text-meta font-medium transition-colors ${
        active ? "" : "text-[#9CA3AF] hover:text-white hover:bg-white/5"
      }`}
      style={active ? { background: "rgba(200,164,90,0.15)", color: "var(--accent)" } : {}}
    >
      {label}
    </Link>
  );
}
