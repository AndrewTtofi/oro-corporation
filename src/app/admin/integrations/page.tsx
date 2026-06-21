import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi, ComingSoon } from "@/components/admin/Kpi";
import { Icon } from "@/components/Icon";
import { UpgradeGate } from "@/components/admin/UpgradeGate";
import { requireRole } from "@/lib/auth/guards";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { INTEGRATIONS, WEBHOOKS, API_KEY, API_BASE } from "@/lib/data/compliance";

export const metadata = { title: "Connect & API" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireRole("staff");
  const { planTier, brandName } = await getBranding();
  if (!tierAtLeast(planTier, "scale")) return <AdminShell active="integrations"><UpgradeGate required="scale" currentTier={planTier} title="Connect & API" desc="Your branded keys and endpoints. Connect ID verification, AML, KYB, payments, calendar and accounting; receive events via webhooks." /></AdminShell>;

  const connected = INTEGRATIONS.filter((i) => i.status === "connected").length;

  return (
    <AdminShell active="integrations">
      <div className="mb-6"><div className="eyebrow mb-2">Configure</div><h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{brandName} Connect &amp; API</h2></div>
      <div className="grid grid-4 mb-6">
        <Kpi label="Connected" value={connected} icon="plug" />
        <Kpi label="Available" value={INTEGRATIONS.length - connected} icon="zap" />
        <Kpi label="Webhooks active" value={WEBHOOKS.filter((w) => w.active).length} icon="refresh" />
        <Kpi label="Last full sync" value="09:04" icon="clock" />
      </div>
      <div className="note mb-6"><Icon name="plug" className="ic-18" /><div>Your branded keys, your endpoints — live data syncs straight into profiles, risk and reporting. Connecting and regenerating keys is <strong>coming soon</strong>.</div></div>

      <div className="eyebrow mb-3">Connected services</div>
      <div className="grid grid-3 mb-8">
        {INTEGRATIONS.map((c) => (
          <div className="card" key={c.id}>
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <div className="row gap-3" style={{ alignItems: "center" }}><div className="kpi-tile"><Icon name={c.icon} className="ic-18" /></div><div><div style={{ fontWeight: 600 }}>{c.name}</div><div className="muted" style={{ fontSize: "var(--fs-xs)" }}>{c.vendor}</div></div></div>
              {c.status === "connected" ? <span className="badge badge-approved"><span className="bdot" />Connected</span> : <span className="badge badge-neutral">Available</span>}
            </div>
            <p className="muted mt-3" style={{ fontSize: "var(--fs-sm)" }}>{c.desc}</p>
            <div className="row-between mt-3">
              <span className="muted mono" style={{ fontSize: "var(--fs-2xs)" }}>{c.status === "connected" ? `Last sync ${c.lastSync}` : "Not connected"}</span>
              <ComingSoon label={c.status === "connected" ? "Manage" : "Connect"} />
            </div>
          </div>
        ))}
      </div>

      <div className="twocol">
        <div className="tbl-wrap">
          <div className="tbl-toolbar"><strong>Webhooks</strong><ComingSoon label="Add endpoint" /></div>
          <table className="tbl">
            <thead><tr><th>Event</th><th>Endpoint</th><th className="t-num">Deliveries</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {WEBHOOKS.map((w) => (
                <tr key={w.event} style={{ cursor: "default" }}>
                  <td><div style={{ fontWeight: 500 }}>{w.event}</div><div className="sub">{w.desc}</div></td>
                  <td className="mono" style={{ fontSize: "var(--fs-xs)" }}>{w.endpoint}</td>
                  <td className="t-num">{w.deliveries}</td>
                  <td><span className={`badge ${w.active ? "badge-approved" : "badge-neutral"}`}>{w.active ? "Active" : "Off"}</span></td>
                  <td style={{ textAlign: "right" }}><ComingSoon label="Send test" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="card-title">API key</h3>
          <div className="field"><label>Live secret key</label><input className="input mono" readOnly value={API_KEY} /></div>
          <div className="row gap-2 mb-4"><ComingSoon label="Copy" /><ComingSoon label="Regenerate" /></div>
          <dl className="dl"><dt>Base URL</dt><dd className="mono">{API_BASE}</dd><dt>Environment</dt><dd>Live</dd></dl>
          <p className="help mt-3">Keys are scoped to your firm. Treat them like a password.</p>
        </div>
      </div>
    </AdminShell>
  );
}
