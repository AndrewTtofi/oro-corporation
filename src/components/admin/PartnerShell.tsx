import Link from "next/link";
import { signOut } from "@/lib/auth";

export function PartnerShell({
  children, active,
}: {
  children: React.ReactNode;
  active: "clients" | "settings";
}) {
  return (
    <div className="shell-partner min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="bg-dark text-white p-6 hidden lg:flex flex-col gap-10">
        <div className="font-display text-lg font-semibold tracking-wider text-accent">ORO PARTNER</div>
        <nav className="flex flex-col gap-1">
          <NavLink href="/partner" label="My Clients" active={active === "clients"} />
          <NavLink href="/partner/settings" label="Settings" active={active === "settings"} />
        </nav>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }} className="mt-auto">
          <button type="submit" className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-inner text-meta font-medium text-[#ef4444] hover:bg-white/5">
            Sign Out
          </button>
        </form>
      </aside>

      <div className="flex flex-col min-w-0">
        <header className="h-16 bg-admin-surface border-b border-admin-border flex items-center justify-between px-8 shrink-0">
          <div className="text-meta text-admin-muted">Partner workspace · read-only</div>
          <div className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold bg-accent text-dark">P</div>
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
