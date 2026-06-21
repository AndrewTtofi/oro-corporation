import Link from "next/link";
import { signOut } from "@/lib/auth";
import { getBranding } from "@/lib/services/branding";

export async function PartnerShell({
  children, active,
}: {
  children: React.ReactNode;
  active: "clients" | "settings";
}) {
  const { brandName } = await getBranding();
  return (
    <div className="shell-partner min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside
        className="hidden lg:flex flex-col gap-12 px-7 py-9 text-bone relative"
        style={{ background: "linear-gradient(180deg, #1A1612 0%, #221C15 100%)" }}
      >
        <Link href="/partner" className="group block">
          <div className="font-display text-[26px] leading-none tracking-[-0.02em] text-accent">
            {brandName}
          </div>
          <div className="mt-2 font-mono text-[9.5px] tracking-[0.32em] uppercase text-bone/45">
            Partner&nbsp;·&nbsp;Counsel
          </div>
          <div
            className="mt-5 h-px w-12 origin-left transition-transform duration-700 ease-out-expo group-hover:scale-x-[2.2]"
            style={{ background: "linear-gradient(90deg, #B08D3E 0%, transparent 100%)" }}
          />
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          <NavLink href="/partner" label="My Clients" active={active === "clients"} />
          <NavLink href="/partner/settings" label="Settings" active={active === "settings"} />
        </nav>

        <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
          <button
            type="submit"
            className="w-full text-left px-3 py-3 text-[12px] tracking-[0.04em] uppercase font-medium text-bone/45 hover:text-oxblood transition-colors duration-500"
          >
            Sign Out
          </button>
        </form>

        <div
          aria-hidden
          className="absolute top-0 right-0 w-px h-full opacity-30"
          style={{ background: "linear-gradient(180deg, transparent 0%, #B08D3E 35%, #B08D3E 65%, transparent 100%)" }}
        />
      </aside>

      <div className="flex flex-col min-w-0">
        <header
          className="h-[72px] flex items-center justify-between px-10 shrink-0"
          style={{ background: "var(--admin-surface)", boxShadow: "0 1px 0 rgba(229,221,201,0.6)" }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-admin-muted">
            Partner&nbsp;·&nbsp;Read-only access
          </div>
          <div
            className="w-10 h-10 grid place-items-center font-mono text-[11px] tracking-[0.1em] uppercase"
            style={{
              background: "var(--ink)",
              color: "var(--accent)",
              borderRadius: "999px",
              boxShadow: "0 0 0 1px rgba(176,141,62,0.4), 0 8px 24px -8px rgba(60,40,16,0.3)",
            }}
          >
            P
          </div>
        </header>
        <main className="px-10 py-12 flex-1 overflow-y-auto page-enter">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-colors duration-500 ${
        active ? "text-bone" : "text-bone/55 hover:text-bone"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] origin-center transition-all duration-500 ${
          active ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
        style={{ background: "#B08D3E" }}
      />
      <span className="relative">
        {label}
        <span
          aria-hidden
          className={`absolute -bottom-0.5 left-0 right-0 h-px transition-transform duration-500 origin-left ${
            active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
          }`}
          style={{ background: "rgba(176,141,62,0.5)" }}
        />
      </span>
    </Link>
  );
}
