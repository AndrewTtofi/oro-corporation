import Link from "next/link";
import { signOut } from "@/lib/auth";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { currentIsSuperAdmin } from "@/lib/auth/guards";
import { Icon } from "@/components/Icon";

type AdminTab =
  | "dashboard" | "submissions" | "compliance-hub"
  | "kyc" | "aml" | "kyb" | "ai-screening" | "ownership-map" | "client-risk" | "aml-reporting" | "compliance-calendar"
  | "leads" | "clients" | "messages"
  | "documents" | "bookings" | "users" | "analytics" | "content"
  | "integrations" | "settings";

const I = {
  dashboard: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  message: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  submissions: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>,
  bookings: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  clients: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  compliance: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  users: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  analytics: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>,
  content: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>,
  settings: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  logout: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  bell: <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
};

const TITLES: Record<AdminTab, string> = {
  dashboard: "Dashboard", submissions: "Submissions", "compliance-hub": "Compliance hub",
  kyc: "KYC / ID verification", aml: "AML screening", kyb: "KYB verification", "ai-screening": "AI screening",
  "ownership-map": "Ownership map", "client-risk": "Client risk", "aml-reporting": "AML reporting", "compliance-calendar": "Compliance calendar",
  leads: "Leads / CRM", clients: "Clients", messages: "Messages",
  documents: "Documents & e-sign", bookings: "Bookings", users: "Users", analytics: "Analytics", content: "Content",
  integrations: "Connect & API", settings: "Settings",
};

export async function AdminShell({
  children,
  active,
  search,
  topRight,
  title,
}: {
  children: React.ReactNode;
  active: AdminTab;
  search?: { placeholder: string };
  topRight?: React.ReactNode;
  title?: string;
}) {
  const { brandName, brandMark, planTier } = await getBranding();
  const superAdmin = await currentIsSuperAdmin();
  const Item = ({ id, href, icon, label }: { id: AdminTab; href: string; icon: React.ReactNode; label: string }) => (
    <Link href={href} className={`sb-item${active === id ? " active" : ""}`}>{icon}<span>{label}</span></Link>
  );

  return (
    <div className="shell shell-admin">
      <aside className="sidebar">
        <div className="sb-org">
          <span className="mk">{brandMark}</span>
          <div>
            <div className="nm">{brandName}</div>
            <div className="rl">{superAdmin ? "Platform admin" : "Firm admin"}</div>
          </div>
        </div>
        <nav className="sb-nav">
          {superAdmin ? (
            <>
              <div className="sb-group">Configuration</div>
              <Item id="settings" href="/admin/settings" icon={I.settings} label="Settings" />
            </>
          ) : (
            <>
              <div className="sb-group">Overview</div>
              <Item id="dashboard" href="/admin" icon={I.dashboard} label="Dashboard" />
              <Item id="submissions" href="/admin/submissions" icon={I.submissions} label="Submissions" />
              <Item id="compliance-hub" href="/admin/compliance" icon={<Icon name="shield" />} label="Compliance hub" />
              {tierAtLeast(planTier, "professional") && (
                <>
                  <div className="sb-group">Compliance</div>
                  {tierAtLeast(planTier, "scale") && (
                    <>
                      <Item id="kyc" href="/admin/compliance/kyc" icon={<Icon name="passport" />} label="KYC / ID verification" />
                      <Item id="aml" href="/admin/compliance/aml" icon={<Icon name="shield" />} label="AML screening" />
                      <Item id="kyb" href="/admin/compliance/kyb" icon={<Icon name="building" />} label="KYB verification" />
                      <Item id="ai-screening" href="/admin/compliance/ai-screening" icon={<Icon name="sparkles" />} label="AI screening" />
                      <Item id="ownership-map" href="/admin/compliance/ownership" icon={<Icon name="sitemap" />} label="Ownership map" />
                      <Item id="client-risk" href="/admin/compliance/risk" icon={<Icon name="scale" />} label="Client risk" />
                      <Item id="aml-reporting" href="/admin/compliance/reporting" icon={<Icon name="documents" />} label="AML reporting" />
                    </>
                  )}
                  <Item id="compliance-calendar" href="/admin/compliance/calendar" icon={<Icon name="calendar" />} label="Compliance calendar" />
                </>
              )}
              <div className="sb-group">Relationships</div>
              <Item id="leads" href="/admin/crm" icon={I.users} label="Leads / CRM" />
              <Item id="clients" href="/admin/clients" icon={I.clients} label="Clients" />
              <Item id="messages" href="/admin/messages" icon={I.message} label="Messages" />
              <div className="sb-group">Engagement</div>
              {tierAtLeast(planTier, "professional") && (
                <Item id="documents" href="/admin/documents" icon={<Icon name="pen" />} label="Documents & e-sign" />
              )}
              <Item id="bookings" href="/admin/bookings" icon={I.bookings} label="Bookings" />
              <div className="sb-group">Firm</div>
              <Item id="users" href="/admin/users" icon={I.users} label="Users" />
              <Item id="analytics" href="/admin/analytics" icon={I.analytics} label="Analytics" />
              <Item id="content" href="/admin/content" icon={I.content} label="Content" />
              {tierAtLeast(planTier, "scale") && (
                <>
                  <div className="sb-group">Configure</div>
                  <Item id="integrations" href="/admin/integrations" icon={<Icon name="plug" />} label="Connect & API" />
                </>
              )}
            </>
          )}
        </nav>
        <div className="sb-foot">
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="sb-item w-full" style={{ background: "transparent", border: 0 }}>{I.logout}<span>Log out</span></button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="appbar">
          <h1>{title ?? TITLES[active]}</h1>
          <div className="appbar-right">
            {search && <div className="searchbox">{I.search}<input placeholder={search.placeholder} /></div>}
            {topRight}
            <div className="bell">{I.bell}<span className="dot" /></div>
            <div className="avatar">AD</div>
          </div>
        </div>
        <main className="appmain page-enter">{children}</main>
      </div>
    </div>
  );
}
