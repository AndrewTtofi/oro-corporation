import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { listLeads } from "@/lib/services/leads";

export const metadata = { title: "Leads / CRM" };
export const dynamic = "force-dynamic";

type Tab = "all" | "leads" | "applicants" | "clients";

type Record_ = {
  key: string;
  name: string;
  email: string;
  service: string;
  type: "Lead" | "Applicant" | "Client";
  stage: string;
  detail: string;
  href?: string;
};

function pretty(s: string | null | undefined) {
  if (!s) return "—";
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("staff");
  const tab = ((await searchParams).tab ?? "all") as Tab;

  const [leads, prospects] = await Promise.all([
    tab === "all" || tab === "leads" ? listLeads() : Promise.resolve([]),
    tab === "all" || tab === "applicants" || tab === "clients"
      ? prisma.prospect.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 200 })
      : Promise.resolve([]),
  ]);

  const records: Record_[] = [];
  if (tab === "all" || tab === "leads") {
    for (const l of leads) {
      records.push({
        key: `lead-${l.id}`,
        name: l.name ?? "(anonymous lead)",
        email: l.email,
        service: pretty(l.serviceKey),
        type: "Lead",
        stage: "Lead",
        detail: l.note ?? l.source,
      });
    }
  }
  for (const p of prospects) {
    const services = Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : [];
    const svc = services.length ? pretty(services[0]) : "—";
    const isClient = p.status === "approved";
    if (isClient && (tab === "all" || tab === "clients")) {
      records.push({ key: `c-${p.id}`, name: p.user.fullName, email: p.user.email, service: svc, type: "Client", stage: "Client", detail: "", href: `/admin/submissions/${p.referenceNumber}` });
    } else if (!isClient && (tab === "all" || tab === "applicants")) {
      records.push({ key: `a-${p.id}`, name: p.user.fullName, email: p.user.email, service: svc, type: "Applicant", stage: p.status, detail: p.referenceNumber, href: `/admin/submissions/${p.referenceNumber}` });
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "All" }, { key: "leads", label: "Leads" },
    { key: "applicants", label: "Applicants" }, { key: "clients", label: "Clients" },
  ];

  return (
    <AdminShell active="leads">
      <div className="mb-12">
        <div className="eyebrow mb-2">Pipeline</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Leads / CRM</h2>
        <p className="mt-2 max-w-[60ch] text-muted" style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
          One pipeline across the whole funnel — anonymous leads from the public tools,
          live applicants in review, and converted clients.
        </p>
      </div>

      <div className="chips mb-6">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "all" ? "/admin/crm" : `/admin/crm?tab=${t.key}`} className={`chip${tab === t.key ? " active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="tbl-wrap">
        <div className="tbl-toolbar">
          <strong>Pipeline</strong>
          <span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{records.length} records</span>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Name</th><th>Service</th><th>Type</th><th>Stage</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={5}><div className="empty"><h3>No records</h3><p>Nothing matches this filter yet.</p></div></td></tr>
            ) : records.map((r) => {
              const initials = r.name === "(anonymous lead)" ? "?" : r.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
              const inner = (
                <>
                  <td>
                    <div className="cell-entity">
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials}</div>
                      <div><div style={{ fontWeight: 500 }}>{r.name}</div><div className="sub">{r.email}</div></div>
                    </div>
                  </td>
                  <td>{r.service}</td>
                  <td><span className="tag">{r.type}</span></td>
                  <td><span className={`badge ${stageClass(r.stage)}`}>{stageLabel(r.stage)}</span></td>
                  <td className="muted">{r.detail}</td>
                </>
              );
              return r.href
                ? <tr key={r.key} style={{ cursor: "pointer" }} className="crm-row" data-href={r.href}>{inner}</tr>
                : <tr key={r.key} style={{ cursor: "default" }}>{inner}</tr>;
            })}
          </tbody>
        </table>
      </div>
      {/* Row click-through for linked records */}
      <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('tr.crm-row').forEach(function(r){r.addEventListener('click',function(){location.href=r.getAttribute('data-href')})})" }} />
    </AdminShell>
  );
}

function stageLabel(s: string) {
  return s === "Lead" ? "Lead" : s === "Client" ? "Client" : s.replace("_", " ");
}
function stageClass(s: string) {
  return s === "Client" ? "badge-approved"
    : s === "approved" ? "badge-approved"
    : s === "needs_info" ? "badge-info"
    : s === "rejected" ? "badge-danger"
    : s === "pending" ? "badge-pending"
    : "badge-neutral";
}
