import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { SubmissionActions } from "./SubmissionActions";
import { CompletenessChip } from "@/components/admin/CompletenessChip";
import { computeCompleteness, generateBrief, detailsToMap, type Completeness } from "@/lib/services/prospect-intel";
import { Role } from "@prisma/client";

export const metadata = { title: "Submission" };

export default async function SubmissionDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  await requireRole("staff");
  const { ref } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { OR: [{ id: ref }, { referenceNumber: ref }] },
    include: {
      user: true,
      details: true,
      documents: { orderBy: { uploadedAt: "asc" } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!prospect) notFound();

  const partners = await prisma.user.findMany({ where: { role: Role.partner }, select: { id: true, fullName: true } });
  const map = Object.fromEntries(prospect.details.map((d) => [d.fieldName, d.fieldValue]));
  const services = Array.isArray(prospect.servicesSelected) ? (prospect.servicesSelected as string[]) : [];
  const assignedPartnerId = ((prospect.draft as Record<string, unknown> | null)?.__assignedPartnerId as string | null | undefined) ?? null;

  // AI-style internal brief + completeness (override wins over the auto score).
  const answers = detailsToMap(prospect.details);
  const docCount = prospect.documents.length;
  const autoCompleteness = (prospect.completeness as Completeness | null)
    ?? computeCompleteness({ services, answers, docCount });
  const effectiveCompleteness = (prospect.completenessOverride as Completeness | null) ?? autoCompleteness;
  const brief = generateBrief({ fullName: map.fullLegalName ?? prospect.user.fullName, services, answers, docCount });

  const activity = await prisma.activityLog.findMany({
    where: { entityType: "prospect", entityId: prospect.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: true },
  });

  return (
    <div className="shell-admin min-h-screen">
      <header className="h-16 bg-admin-surface border-b border-admin-border flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/admin/submissions" className="px-3 py-1.5 rounded-inner border border-admin-border text-meta text-admin-fg font-medium">
            ← Back
          </Link>
          <span className="font-bold font-mono">{prospect.referenceNumber}</span>
          <span className={`badge ${statusClass(prospect.status)}`}>{prettyStatus(prospect.status)}</span>
        </div>
        <div className="text-meta text-admin-muted">
          Submitted {prospect.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-10 my-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-8">
          <section className="bg-admin-surface border border-admin-border rounded-elem p-8" style={{ borderColor: "var(--brand)" }}>
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-3">
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /></svg>
                <h2 className="text-lg font-bold">AI-generated internal brief</h2>
              </div>
              <CompletenessChip value={effectiveCompleteness} />
            </div>
            <p style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>{brief}</p>
            <hr className="hairline" style={{ margin: "16px 0" }} />
            <p className="text-[12px] text-admin-muted">
              Auto-drafted from the applicant&apos;s intake answers and documents on file. Adjust the brief-completeness score in the sidebar to reprioritise prep.
            </p>
          </section>

          <Card title="Personal Information">
            <Grid2>
              <Row label="Full Legal Name" value={map.fullLegalName ?? prospect.user.fullName} />
              <Row label="Email" value={prospect.user.email} />
              <Row label="Nationality" value={map.nationality} />
              <Row label="Residence" value={map.residenceCountry} />
              <Row label="Date of Birth" value={map.dateOfBirth?.slice(0, 10)} />
              <Row label="Phone" value={prospect.user.phone ?? "—"} />
            </Grid2>
            <Row label="Address" value={map.address} multiline />
          </Card>

          <Card title="Business Intent">
            <Row label="Activity Description" value={map.businessDescription} multiline />
            <Grid2>
              <Row label="Expected Turnover" value={map.expectedTurnover} />
              <Row label="Timeline" value={pretty(map.timeline)} />
              <Row label="Source" value={pretty(map.source)} />
              <Row label="Services" value={services.map(pretty).join(", ")} />
            </Grid2>
          </Card>

          <Card title="Service Specifics">
            <Grid2>
              <Row label="Proposed company name" value={map.proposedCompanyName} />
              <Row label="Business activity" value={map.businessActivity} />
              <Row label="Shareholders" value={map.shareholderCount} />
              <Row label="Nominee services" value={map.nomineeServices} />
              <Row label="Tax residency country" value={map.currentTaxResidency} />
              <Row label="60+ days in Cyprus" value={map.daysInCyprus60Plus} />
              <Row label="Employment" value={map.employmentStatus} />
              <Row label="Permit type" value={pretty(map.permitType)} />
              <Row label="Family count" value={map.familyCount} />
              <Row label="License type" value={map.licenseType} />
              <Row label="Account purpose" value={map.accountPurpose} />
              <Row label="Monthly tx volume" value={map.monthlyTxVolume} />
            </Grid2>
          </Card>

          <Card title="Uploaded Documents">
            {prospect.documents.length === 0 ? (
              <p className="text-meta text-admin-muted">No documents uploaded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {prospect.documents.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"
                       className="flex items-center gap-3 p-3 rounded-inner text-meta border border-admin-border hover:border-accent hover:bg-admin-bg">
                      <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium flex-1 truncate">{d.originalName}</span>
                      <span className="text-[12px] text-admin-muted">{formatSize(d.sizeBytes)}</span>
                      <span className={`badge ${docStatusClass(d.status)}`}>{prettyDocStatus(d.status)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 self-start">
          <SubmissionActions
            prospect={{ id: prospect.id, status: prospect.status, referenceNumber: prospect.referenceNumber }}
            partners={partners}
            assignedPartnerId={assignedPartnerId}
            completenessOverride={(prospect.completenessOverride as Completeness | null) ?? null}
            autoCompleteness={autoCompleteness}
            initialNotes={prospect.internalNotes.map((n) => ({
              id: n.id,
              author: n.author.fullName,
              body: n.body,
              createdAt: n.createdAt.toISOString(),
            }))}
            activity={activity.map((a) => ({
              id: a.id,
              action: a.action,
              actor: a.actor?.fullName ?? "System",
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </aside>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-admin-surface border border-admin-border rounded-elem p-8">
      <h2 className="text-lg font-bold mb-6">{title}</h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>;
}

function Row({ label, value, multiline }: { label: string; value?: string | number | boolean | null; multiline?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  const str = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-admin-muted mb-1 font-semibold">{label}</div>
      <div className={`text-meta font-medium ${multiline ? "leading-relaxed" : ""}`}>{str}</div>
    </div>
  );
}

function pretty(s: string | undefined) {
  if (!s) return s;
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function prettyStatus(s: string) {
  return s === "pending" ? "Pending Review"
       : s === "needs_info" ? "Needs Info"
       : s === "approved" ? "Approved"
       : "Rejected";
}
function statusClass(s: string) {
  return s === "approved" ? "badge-approved"
       : s === "needs_info" ? "badge-info"
       : s === "rejected" ? "badge-danger"
       : "badge-pending";
}
function prettyDocStatus(s: string) {
  return s === "approved" ? "Approved"
       : s === "under_review" ? "Under Review"
       : s === "reupload_needed" ? "Re-upload"
       : "Received";
}
function docStatusClass(s: string) {
  return s === "approved" ? "badge-approved"
       : s === "under_review" ? "badge-info"
       : s === "reupload_needed" ? "badge-danger"
       : "badge-pending";
}
function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
