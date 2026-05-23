import Link from "next/link";
import { signOut } from "@/lib/auth";

interface NavItem { label: string; href: string; locked?: boolean; icon: React.ReactNode }

export function ClientShell({
  children,
  active,
  approved,
}: {
  children: React.ReactNode;
  active: "dashboard" | "application" | "messages" | "documents" | "booking" | "settings";
  approved: boolean;
}) {
  const nav: NavItem[] = [
    { label: "Dashboard", href: "/app/dashboard", icon: HomeIcon },
    { label: "My Application", href: "/app/application", icon: FileIcon },
    { label: "Messages", href: "/app/messages", icon: ChatIcon },
    { label: "Documents", href: "/app/documents", icon: UploadIcon },
    { label: "Book Consultation", href: "/app/booking", locked: !approved, icon: CalendarIcon },
  ];

  return (
    <div className="shell-client min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside className="bg-dark text-white p-8 hidden lg:flex flex-col gap-10" style={{ color: "var(--client-bg)" }}>
        <div className="flex items-center gap-3 font-display text-lg font-semibold">
          <span className="w-8 h-8 rounded grid place-items-center bg-[var(--client-bg)] text-dark font-display text-base">O</span>
          <span>ORO CORPORATE</span>
        </div>
        <nav className="flex flex-col gap-2">
          {nav.map((n) => {
            const isActive = active === routeKey(n.href);
            const cls = `flex items-center gap-3 px-4 py-3 rounded-elem text-meta font-medium transition-colors ${
              isActive
                ? "text-dark"
                : n.locked
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5"
            }`;
            const style = isActive ? { background: "var(--accent)" } : {};
            return n.locked ? (
              <span key={n.href} className={cls} style={style} aria-disabled>
                <span className="w-[18px] h-[18px]">{n.icon}</span>
                {n.label}
              </span>
            ) : (
              <Link key={n.href} href={n.href} className={cls} style={style} aria-current={isActive ? "page" : undefined}>
                <span className="w-[18px] h-[18px]">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link href="/app/settings" className="flex items-center gap-3 px-4 py-3 rounded-elem text-meta font-medium hover:bg-white/5">
            <span className="w-[18px] h-[18px]">{SettingsIcon}</span>
            Settings
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="w-full flex items-center gap-3 px-4 py-3 rounded-elem text-meta font-medium hover:bg-white/5" style={{ color: "#ef4444" }}>
              <span className="w-[18px] h-[18px]">{SignOutIcon}</span>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <main className="px-6 lg:px-16 py-12 overflow-y-auto">{children}</main>
    </div>
  );
}

function routeKey(href: string): "dashboard" | "application" | "messages" | "documents" | "booking" | "settings" {
  if (href.includes("dashboard")) return "dashboard";
  if (href.includes("application")) return "application";
  if (href.includes("messages")) return "messages";
  if (href.includes("documents")) return "documents";
  if (href.includes("booking")) return "booking";
  return "settings";
}

const HomeIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
);
const FileIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const ChatIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
);
const UploadIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);
const CalendarIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const SettingsIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const SignOutIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
);
