import Link from "next/link";
import { signOut } from "@/lib/auth";
import { getBranding } from "@/lib/services/branding";

type ActiveKey = "dashboard" | "application" | "messages" | "documents" | "booking" | "marketplace" | "applications" | "settings";

const I = {
  dashboard: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  users: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  briefcase: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  documents: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>,
  message: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  calendar: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  settings: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  logout: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  lock: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  bell: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
};

const TITLES: Record<ActiveKey, string> = {
  dashboard: "Dashboard",
  application: "My application",
  documents: "Documents",
  messages: "Messages",
  booking: "Book consultation",
  marketplace: "Partner network",
  applications: "My applications",
  settings: "Settings",
};

export async function ClientShell({
  children,
  active,
  approved,
  title,
}: {
  children: React.ReactNode;
  active: ActiveKey;
  approved: boolean;
  title?: string;
}) {
  const { brandName, brandMark } = await getBranding();
  const Item = ({ id, icon, label, locked }: { id: ActiveKey; icon: React.ReactNode; label: string; locked?: boolean }) => {
    const cls = `sb-item${active === id ? " active" : ""}${locked ? " locked" : ""}`;
    const inner = <>{icon}<span>{label}</span>{locked && <span className="lockic">{I.lock}</span>}</>;
    return locked ? <span className={cls} aria-disabled>{inner}</span> : <Link href={`/app/${id}`} className={cls}>{inner}</Link>;
  };

  return (
    <div className="shell shell-client">
      <aside className="sidebar">
        <div className="sb-org">
          <span className="mk">{brandMark}</span>
          <div>
            <div className="nm">{brandName}</div>
            <div className="rl">Client portal</div>
          </div>
        </div>
        <nav className="sb-nav">
          <div className="sb-group">Overview</div>
          <Item id="dashboard" icon={I.dashboard} label="Dashboard" />
          <Item id="application" icon={I.briefcase} label="My application" />
          <div className="sb-group">Engagement</div>
          <Item id="documents" icon={I.documents} label="Documents" />
          <Item id="messages" icon={I.message} label="Messages" />
          <Item id="booking" icon={I.calendar} label="Book consultation" locked={!approved} />
          <div className="sb-group">Network</div>
          <Item id="marketplace" icon={I.users} label="Partner network" />
          <Item id="applications" icon={I.briefcase} label="My applications" />
        </nav>
        <div className="sb-foot">
          <Link href="/app/settings" className={`sb-item${active === "settings" ? " active" : ""}`}>{I.settings}<span>Settings</span></Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="sb-item w-full" style={{ background: "transparent", border: 0 }}>{I.logout}<span>Log out</span></button>
          </form>
        </div>
      </aside>

      <div>
        <div className="appbar">
          <h1>{title ?? TITLES[active]}</h1>
          <div className="appbar-right">
            <div className="searchbox">{I.search}<input placeholder="Search…" /></div>
            <div className="bell">{I.bell}<span className="dot" /></div>
            <div className="avatar">CL</div>
          </div>
        </div>
        <main className="appmain page-enter">{children}</main>
      </div>
    </div>
  );
}
