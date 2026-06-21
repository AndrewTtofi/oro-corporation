import { AdminShell } from "@/components/admin/AdminShell";
import { Kpi } from "@/components/admin/Kpi";
import { prisma } from "@/lib/db";
import { ProspectStatus, BookingStatus } from "@prisma/client";

export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  const [
    total, pending, approved, rejected,
    bookingsTotal, noShows, completed,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: ProspectStatus.pending } }),
    prisma.prospect.count({ where: { status: ProspectStatus.approved } }),
    prisma.prospect.count({ where: { status: ProspectStatus.rejected } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: BookingStatus.no_show } }),
    prisma.booking.count({ where: { status: BookingStatus.completed } }),
  ]);

  // By service
  const allProspects = await prisma.prospect.findMany({ select: { servicesSelected: true } });
  const serviceCounts = new Map<string, number>();
  for (const p of allProspects) {
    for (const s of Array.isArray(p.servicesSelected) ? (p.servicesSelected as string[]) : []) {
      serviceCounts.set(s, (serviceCounts.get(s) ?? 0) + 1);
    }
  }
  const byService = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1]);

  // By country (residence)
  const detailsByCountry = await prisma.prospectDetail.findMany({
    where: { fieldName: "residenceCountry" },
    select: { fieldValue: true },
  });
  const countryCounts = new Map<string, number>();
  for (const d of detailsByCountry) {
    countryCounts.set(d.fieldValue, (countryCounts.get(d.fieldValue) ?? 0) + 1);
  }
  const topCountries = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Average time to consultation = time between submission and first booking
  const submittedToBooking = await prisma.booking.findMany({
    select: { startsAt: true, prospect: { select: { createdAt: true } } },
  });
  const avgDays = submittedToBooking.length
    ? Math.round(submittedToBooking.reduce((sum, b) => sum + (b.startsAt.getTime() - b.prospect.createdAt.getTime()), 0) / submittedToBooking.length / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <AdminShell active="analytics">
      <div className="mb-6">
        <div className="eyebrow mb-2">Firm</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Analytics</h2>
        <p className="muted mt-2" style={{ fontSize: "var(--fs-sm)" }}>Headline metrics derived from the application database.</p>
      </div>

      <div className="grid grid-4 mb-6">
        <Kpi label="Submissions (all-time)" value={total} icon="documents" />
        <Kpi label="Pending review" value={pending} icon="flag" />
        <Kpi label="Approval rate" value={total ? `${Math.round((approved / total) * 100)}%` : "—"} icon="check" />
        <Kpi label="Rejections" value={rejected} icon="x" />
        <Kpi label="Consultations booked" value={bookingsTotal} icon="calendar" />
        <Kpi label="Completed" value={completed} icon="check" />
        <Kpi label="No-shows" value={noShows} icon="flag" />
        <Kpi label="Avg time to consult." value={`${avgDays} d`} icon="clock" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Submissions by service</h3>
          {byService.length === 0 ? <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>No data yet.</p> :
            <ul className="row" style={{ flexDirection: "column", gap: 12, alignItems: "stretch" }}>
              {byService.map(([service, count]) => {
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <li key={service}>
                    <div className="row-between" style={{ fontSize: "var(--fs-sm)", marginBottom: 4 }}>
                      <span>{pretty(service)}</span>
                      <span className="mono muted">{count}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--admin-border)" }}>
                      <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: "var(--brand)" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          }
        </div>

        <div className="card">
          <h3 className="card-title">Top countries</h3>
          {topCountries.length === 0 ? <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>No data yet.</p> :
            <ul className="row" style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}>
              {topCountries.map(([country, count]) => (
                <li key={country} className="row-between" style={{ fontSize: "var(--fs-sm)" }}>
                  <span>{country}</span>
                  <span className="mono muted">{count}</span>
                </li>
              ))}
            </ul>
          }
        </div>
      </div>
    </AdminShell>
  );
}

function pretty(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
