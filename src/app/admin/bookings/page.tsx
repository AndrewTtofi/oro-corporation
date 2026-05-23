import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

export const metadata = { title: "Bookings" };

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: [BookingStatus.confirmed, BookingStatus.completed] } },
    orderBy: { startsAt: "asc" },
    include: {
      expert: true,
      prospect: { include: { user: true, client: true } },
    },
    take: 200,
  });

  const upcoming = bookings.filter((b) => b.startsAt >= new Date() && b.status === "confirmed");
  const past = bookings.filter((b) => b.startsAt < new Date() || b.status !== "confirmed");

  return (
    <AdminShell active="bookings">
      <h1 className="text-2xl font-bold mb-2">Bookings</h1>
      <p className="text-meta text-admin-muted mb-8">All upcoming and past consultations.</p>

      <Section title={`Upcoming · ${upcoming.length}`}>
        <BookingTable rows={upcoming} />
      </Section>

      <Section title={`Past · ${past.length}`}>
        <BookingTable rows={past.slice(0, 50)} />
      </Section>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">{title}</h2>
      {children}
    </section>
  );
}

function BookingTable({ rows }: { rows: Array<{
  id: string; startsAt: Date; timezone: string; status: BookingStatus; durationMinutes: number;
  expert: { fullName: string };
  prospect: { id: string; referenceNumber: string; user: { fullName: string; email: string }; client: { id: string } | null };
}> }) {
  if (rows.length === 0) {
    return <div className="bg-admin-surface border border-admin-border rounded-elem p-8 text-center text-admin-muted text-meta">Nothing here yet.</div>;
  }
  return (
    <div className="bg-admin-surface border border-admin-border rounded-elem overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr style={{ background: "#FDFDFD" }}>
            <Th>When</Th>
            <Th>Applicant</Th>
            <Th>Reference</Th>
            <Th>Expert</Th>
            <Th>Status</Th>
            <Th>Profile</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-admin-border">
              <Td>
                <div className="font-medium">{b.startsAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div className="font-mono text-[12px] text-admin-muted">{b.startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: b.timezone })} {b.timezone}</div>
              </Td>
              <Td>
                <div className="font-semibold">{b.prospect.user.fullName}</div>
                <div className="text-[12px] text-admin-muted">{b.prospect.user.email}</div>
              </Td>
              <Td className="font-mono">{b.prospect.referenceNumber}</Td>
              <Td>{b.expert.fullName}</Td>
              <Td><span className="badge badge-info">{b.status}</span></Td>
              <Td>
                {b.prospect.client ? (
                  <Link href={`/admin/clients/${b.prospect.client.id}`} className="text-accent text-meta font-semibold">View client</Link>
                ) : (
                  <Link href={`/admin/submissions/${b.prospect.referenceNumber}`} className="text-accent text-meta font-semibold">View submission</Link>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-admin-muted font-semibold whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-4 text-meta align-middle ${className}`}>{children}</td>;
}
