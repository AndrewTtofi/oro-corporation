import { AdminShell } from "@/components/admin/AdminShell";
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
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-meta text-admin-muted mb-8">Headline metrics derived from the application database.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <Kpi label="Submissions (all-time)" value={total} />
        <Kpi label="Pending review" value={pending} accent />
        <Kpi label="Approval rate" value={total ? `${Math.round((approved / total) * 100)}%` : "—"} />
        <Kpi label="Rejections" value={rejected} />
        <Kpi label="Consultations booked" value={bookingsTotal} />
        <Kpi label="Completed" value={completed} />
        <Kpi label="No-shows" value={noShows} />
        <Kpi label="Avg time to consult." value={`${avgDays} d`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-admin-surface border border-admin-border rounded-card p-6">
          <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-4">Submissions by service</h2>
          {byService.length === 0 ? <p className="text-meta text-admin-muted">No data yet.</p> :
            <ul className="flex flex-col gap-3">
              {byService.map(([service, count]) => {
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <li key={service}>
                    <div className="flex justify-between text-meta mb-1">
                      <span>{pretty(service)}</span>
                      <span className="font-mono text-admin-muted">{count}</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--bg)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          }
        </section>

        <section className="bg-admin-surface border border-admin-border rounded-card p-6">
          <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-4">Top countries</h2>
          {topCountries.length === 0 ? <p className="text-meta text-admin-muted">No data yet.</p> :
            <ul className="flex flex-col gap-2">
              {topCountries.map(([country, count]) => (
                <li key={country} className="flex justify-between text-meta">
                  <span>{country}</span>
                  <span className="font-mono text-admin-muted">{count}</span>
                </li>
              ))}
            </ul>
          }
        </section>
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-admin-surface border border-admin-border rounded-card p-5">
      <div className="text-[11px] uppercase tracking-widest text-admin-muted font-semibold">{label}</div>
      <div className={`font-display text-3xl mt-2 ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function pretty(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
