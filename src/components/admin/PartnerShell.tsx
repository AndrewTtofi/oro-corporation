import Link from "next/link";
import { signOut } from "@/lib/auth";
import { getBranding } from "@/lib/services/branding";

const I = {
  users: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  settings: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  logout: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  bell: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
};

const TITLES = { clients: "Assigned clients", settings: "Settings" } as const;

export async function PartnerShell({
  children, active,
}: {
  children: React.ReactNode;
  active: "clients" | "settings";
}) {
  const { brandName, brandMark } = await getBranding();
  return (
    <div className="shell shell-admin">
      <aside className="sidebar">
        <div className="sb-org">
          <span className="mk">{brandMark}</span>
          <div>
            <div className="nm">{brandName}</div>
            <div className="rl">Partner · scoped access</div>
          </div>
        </div>
        <nav className="sb-nav">
          <div className="sb-group">Scoped access</div>
          <Link href="/partner" className={`sb-item${active === "clients" ? " active" : ""}`}>{I.users}<span>My assigned clients</span></Link>
        </nav>
        <div className="sb-foot">
          <Link href="/partner/settings" className={`sb-item${active === "settings" ? " active" : ""}`}>{I.settings}<span>Settings</span></Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="sb-item w-full" style={{ background: "transparent", border: 0 }}>{I.logout}<span>Log out</span></button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="appbar">
          <h1>{TITLES[active]}</h1>
          <div className="appbar-right">
            <div className="bell">{I.bell}<span className="dot" /></div>
            <div className="avatar">P</div>
          </div>
        </div>
        <main className="appmain page-enter">{children}</main>
      </div>
    </div>
  );
}
