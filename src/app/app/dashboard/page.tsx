import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { getProspectForUser } from "@/lib/services/client-view";

export const metadata = { title: "Dashboard" };

export default async function ClientDashboard() {
  const user = await requireUser();
  const prospect = await getProspectForUser(user.id);
  if (!prospect) redirect("/onboarding");

  const status = prospect.status;
  const isApproved = status === "approved";
  const statusBadge = ({
    pending:    { cls: "badge-pending", label: "Under Review" },
    approved:   { cls: "badge-approved", label: "Approved" },
    needs_info: { cls: "badge-info", label: "Needs Information" },
    rejected:   { cls: "badge-danger", label: "Rejected" },
  } as const)[status];

  const upcomingBooking = prospect.bookings.find((b) => b.status === "confirmed" && b.startsAt >= new Date());
  const services = Array.isArray(prospect.servicesSelected) ? (prospect.servicesSelected as string[]) : [];

  return (
    <ClientShell active="dashboard" approved={isApproved}>
      <div className="flex justify-between items-start mb-12 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl mb-2">Welcome back, {user.fullName?.split(" ")[0] ?? "there"}</h1>
          <p className="text-muted">Application {prospect.referenceNumber} {status === "pending" ? "is currently under review." : "."}</p>
        </div>
        <span className={`badge ${statusBadge.cls}`}>
          <span className="w-2 h-2 rounded-full inline-block mr-2"
                style={{ background: "currentColor", opacity: 0.7 }} />
          {statusBadge.label}
        </span>
      </div>

      <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-8">
          <section className="surface rounded-card p-8">
            <h2 className="text-lg font-semibold mb-6">Application Progress</h2>
            <ol className="relative pl-8 flex flex-col gap-8 before:absolute before:left-[7px] before:top-0 before:bottom-0 before:w-px"
                style={{ ["--tw" as never]: "" }}>
              <span aria-hidden className="absolute left-[7px] top-0 bottom-0 w-px" style={{ background: "var(--border)" }} />
              <TimelineItem done active={false} title="Submitted" body={`Application and initial documents received on ${prospect.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`} />
              <TimelineItem done={status !== "pending" && status !== "needs_info"} active={status === "pending" || status === "needs_info"} title="Under Review" body="Our compliance team is verifying your details. This usually takes 24-48 hours." />
              <TimelineItem done={isApproved} active={false} title="Final Approval" body="Once approved, you will be invited to book your consultation." />
            </ol>

            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              <Link href="/app/application" className="flex items-center gap-3 p-4 rounded-elem border transition-colors hover:bg-surface"
                    style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                <span className="w-5 h-5 text-accent">{ViewIcon}</span>
                <span className="text-meta">View Application</span>
              </Link>
              <Link href="/app/documents" className="flex items-center gap-3 p-4 rounded-elem border transition-colors hover:bg-surface"
                    style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                <span className="w-5 h-5 text-accent">{UploadIcon}</span>
                <span className="text-meta">Upload More Docs</span>
              </Link>
            </div>
          </section>

          <section className="surface rounded-card p-8">
            <h2 className="text-lg font-semibold mb-6">Recent Messages</h2>
            {prospect.messages.length === 0 ? (
              <div className="text-center py-10 text-muted text-meta">
                <span className="block w-12 h-12 mx-auto mb-4 opacity-20">{ChatIcon}</span>
                <p>No messages yet. We&apos;ll contact you if we need more information.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {prospect.messages.slice(0, 4).map((m) => (
                  <li key={m.id} className="flex flex-col gap-1 pb-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                    <div className="flex justify-between text-meta">
                      <span className="font-semibold">{m.sender.fullName}</span>
                      <span className="text-muted">{m.createdAt.toLocaleDateString()}</span>
                    </div>
                    <p className="text-meta text-muted truncate">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section className="rounded-card p-8 text-white" style={{ background: "var(--dark)", color: "var(--client-bg)" }}>
            <h2 className="text-accent text-lg font-semibold">Expert Consultation</h2>
            {isApproved ? (
              upcomingBooking ? (
                <div className="mt-6">
                  <p className="text-sm opacity-70 mb-3">Upcoming consultation</p>
                  <div className="font-display text-2xl">
                    {upcomingBooking.startsAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
                  </div>
                  <p className="text-meta opacity-60 mt-1">with {upcomingBooking.expert.fullName}</p>
                  <Link href="/app/booking" className="btn btn-accent mt-6 px-5 py-2.5">Manage booking</Link>
                </div>
              ) : (
                <>
                  <p className="text-meta opacity-70 mt-3 mb-6 leading-relaxed">
                    Your application is approved. Book a free consultation with one of our experts.
                  </p>
                  <Link href="/app/booking" className="btn btn-accent px-5 py-2.5">Book consultation</Link>
                </>
              )
            ) : (
              <>
                <p className="text-meta opacity-70 mt-3 mb-6 leading-relaxed">
                  Your consultation booking will become available once your application status changes to &ldquo;Approved&rdquo;.
                </p>
                <div className="rounded-elem p-6 text-center" style={{ border: "1px dashed rgba(200,164,90,0.3)" }}>
                  <span className="block w-8 h-8 mx-auto mb-3 text-accent opacity-50">{LockIcon}</span>
                  <div className="text-meta font-semibold uppercase tracking-widest text-accent">Locked</div>
                </div>
              </>
            )}
          </section>

          <section className="surface rounded-card p-8">
            <h2 className="text-lg font-semibold mb-6">Selected Services</h2>
            {services.length === 0 ? (
              <p className="text-muted text-meta">No services selected yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {services.map((s) => (
                  <li key={s} className="flex items-center gap-3 text-meta">
                    <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                    {s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </ClientShell>
  );
}

function TimelineItem({ done, active, title, body }: { done: boolean; active: boolean; title: string; body: string }) {
  return (
    <li className="relative">
      <span
        className={`absolute left-[-32px] top-1 w-4 h-4 rounded-full border-2 z-10 ${active ? "animate-pulse-accent" : ""}`}
        style={
          done
            ? { background: "var(--accent)", borderColor: "var(--accent)" }
            : active
              ? { background: "var(--surface)", borderColor: "var(--accent)" }
              : { background: "var(--surface)", borderColor: "var(--border)" }
        }
      />
      <h3 className="text-meta font-semibold mb-1">{title}</h3>
      <p className="text-meta text-muted">{body}</p>
    </li>
  );
}

const ViewIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);
const UploadIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
);
const ChatIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
);
const LockIcon = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);
