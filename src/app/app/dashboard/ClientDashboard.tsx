import Link from "next/link";

type Service = { id: string; serviceType: string; status: string };
type KeyDate = { id: string; description: string; dueDate: Date; status: string };
type DocReq = { id: string; description: string; dueAt: Date | null };
type Activity = { id: string; action: string; createdAt: Date };

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const titleize = (s: string) => s.split(/[._]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");

export function ClientDashboard({
  name,
  brandName,
  since,
  complianceStatus,
  riskRating,
  services,
  upcomingKeyDates,
  openRequests,
  unreadMessageCount,
  recentActivity,
  hasUpcomingBookingWithin14Days,
}: {
  name: string;
  brandName: string;
  since: Date;
  complianceStatus: "open" | "in_review" | "cleared" | "blocked" | null;
  riskRating: "low" | "standard" | "high" | null;
  services: Service[];
  upcomingKeyDates: KeyDate[];
  openRequests: DocReq[];
  unreadMessageCount: number;
  recentActivity: Activity[];
  hasUpcomingBookingWithin14Days: boolean;
}) {
  const first = name.split(" ")[0] ?? "there";
  const activeServices = services.filter((s) => s.status !== "completed").length;

  const kpis = [
    { t: "Active services", v: activeServices },
    { t: "Upcoming (30d)", v: upcomingKeyDates.length },
    { t: "Open requests", v: openRequests.length },
    { t: "Messages (7d)", v: unreadMessageCount },
  ];

  return (
    <>
      <div className="page-head">
        <h2>Welcome back, {first}</h2>
        <p>
          Client since {fmtDate(since)}
          {complianceStatus && <> · Compliance: {titleize(complianceStatus)}</>}
          {riskRating && <> · Risk: {titleize(riskRating)}</>}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((k) => (
          <div key={k.t} className="kpi">
            <div className="text-muted" style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.t}</div>
            <div className="kpi-value">{k.v}</div>
          </div>
        ))}
      </div>

      <div className="twocol">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {openRequests.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>{brandName} has requested</h3>
                <Link href="/app/documents" className="text-brand" style={{ fontSize: "0.8125rem" }}>Open documents →</Link>
              </div>
              <ul className="flex flex-col">
                {openRequests.slice(0, 5).map((r, i) => (
                  <li key={r.id} className="py-3 flex justify-between items-baseline gap-6" style={i ? { borderTop: "1px solid var(--border)" } : undefined}>
                    <span style={{ fontSize: "0.875rem" }}>{r.description}</span>
                    {r.dueAt && <span className="figure text-muted" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>due {fmtShort(r.dueAt)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="card-title">Upcoming key dates</div>
            {upcomingKeyDates.length === 0 ? (
              <p className="text-muted" style={{ fontSize: "0.875rem" }}>None in the next 30 days.</p>
            ) : (
              <ul className="flex flex-col">
                {upcomingKeyDates.slice(0, 6).map((kd, i) => (
                  <li key={kd.id} className="py-3 flex justify-between items-baseline gap-6" style={i ? { borderTop: "1px solid var(--border)" } : undefined}>
                    <span style={{ fontSize: "0.875rem" }}>{kd.description}</span>
                    {kd.status === "overdue"
                      ? <span className="badge badge-rejected">Overdue</span>
                      : <span className="figure text-muted" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{fmtDate(kd.dueDate)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {recentActivity.length > 0 && (
            <div className="card">
              <div className="card-title">Recent activity</div>
              <ul className="flex flex-col">
                {recentActivity.slice(0, 6).map((a, i) => (
                  <li key={a.id} className="py-2.5 flex items-baseline gap-6" style={i ? { borderTop: "1px solid var(--border)" } : undefined}>
                    <span className="figure text-muted" style={{ fontSize: "0.6875rem", width: 80, flexShrink: 0 }}>{fmtShort(a.createdAt)}</span>
                    <span style={{ fontSize: "0.875rem" }}>{titleize(a.action)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="card-title">Consultation</div>
            {hasUpcomingBookingWithin14Days ? (
              <>
                <p className="text-muted" style={{ fontSize: "0.875rem" }}>You have an upcoming consultation booked.</p>
                <Link href="/app/booking" className="btn btn-secondary btn-block mt-4">Manage booking</Link>
              </>
            ) : (
              <>
                <p className="text-muted" style={{ fontSize: "0.875rem" }}>Book a consultation with your advisor — pick a slot in the next 14 days.</p>
                <Link href="/app/booking" className="btn btn-primary btn-block mt-4">Book a meeting →</Link>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">Selected services</div>
            {services.length === 0 ? (
              <p className="text-muted" style={{ fontSize: "0.875rem" }}>No services selected yet.</p>
            ) : (
              <div className="flex flex-col gap-2 items-start">
                {services.map((s) => (
                  <span key={s.id} className={`badge ${s.status === "completed" ? "badge-approved" : "badge-new"}`}>
                    {titleize(s.serviceType)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
