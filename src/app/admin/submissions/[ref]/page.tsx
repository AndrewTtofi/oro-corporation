import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { SubmissionActions } from "./SubmissionActions";
import { CompletenessChip } from "@/components/admin/CompletenessChip";
import { Icon } from "@/components/Icon";
import { computeCompleteness, generateBrief, detailsToMap, type Completeness } from "@/lib/services/prospect-intel";
import { getBranding, tierAtLeast } from "@/lib/services/branding";
import { amlResult } from "@/lib/services/aml";
import { RegenerateBriefButton } from "./RegenerateBriefButton";
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

  // AML screening (Scale-gated) shown inline on the file.
  const { planTier } = await getBranding();
  const amlEnabled = tierAtLeast(planTier, "scale");
  const aml = amlEnabled ? amlResult(prospect.referenceNumber) : null;

  const activity = await prisma.activityLog.findMany({
    where: { entityType: "prospect", entityId: prospect.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: true },
  });

  return (
    <div className="shell-admin min-h-screen">
      <div className="appmain">
      <div className="page-head">
        <Link className="muted" href="/admin/submissions" style={{ fontSize: "var(--fs-xs)" }}>
          ← Back to queue
        </Link>
        <div className="row-between mt-2">
          <div>
            <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{prospect.user.fullName}</h2>
            <p className="mono muted mt-1" style={{ fontSize: "var(--fs-xs)" }}>
              {prospect.referenceNumber}
              {" · "}
              Submitted {prospect.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <span className={`badge ${statusClass(prospect.status)}`}>{prettyStatus(prospect.status)}</span>
        </div>
      </div>

      <div className="twocol">
        <div>
          <section className="card mb-4" style={{ borderColor: "var(--brand)" }}>
            <div className="row-between mb-3" style={{ alignItems: "flex-start", gap: 16 }}>
              <div className="row gap-3" style={{ alignItems: "center" }}>
                <Icon name="sparkles" />
                <h3 style={{ fontWeight: 600 }}>AI-generated internal brief</h3>
              </div>
              <div className="row gap-3" style={{ alignItems: "center" }}>
                <CompletenessChip value={effectiveCompleteness} />
                <RegenerateBriefButton />
              </div>
            </div>
            <p style={{ fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{brief}</p>
            <div className="hr" />
            <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
              Auto-drafted from the applicant&apos;s intake answers and documents on file. Adjust the brief-completeness score in the sidebar to reprioritise prep.
            </p>
          </section>

          {/* ── AML / KYC screening (Scale plan) ──────────────────────── */}
          <section className="card mb-4">
            <div className="row-between mb-4" style={{ alignItems: "center", gap: 16 }}>
              <div className="row gap-3" style={{ alignItems: "center" }}>
                <Icon name="shield" />
                <h3 style={{ fontWeight: 600 }}>AML / KYC screening</h3>
              </div>
              {aml && <span className={`badge ${aml.risk === "low" ? "badge-approved" : aml.risk === "medium" ? "badge-pending" : "badge-danger"}`}>{aml.risk} risk</span>}
            </div>
            {aml ? (
              <div className="grid grid-3" style={{ gap: 10 }}>
                {([["Sanctions", aml.sanctions], ["PEP", aml.pep], ["Adverse media", aml.adverse]] as const).map(([label, v]) => (
                  <div key={label} className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
                    <div className="mt-2">
                      <span className={`badge ${v === "clear" ? "badge-approved" : v === "match" ? "badge-pending" : "badge-danger"}`}>
                        {v === "clear" ? "Clear" : v === "match" ? "PEP match" : "Adverse"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                Sanctions, PEP and adverse-media screening is a <strong>Scale</strong>-plan feature. Ask your platform admin to enable it.
              </p>
            )}
          </section>

          <Card title="Personal Information">
            <dl className="dl">
              <Row label="Full Legal Name" value={map.fullLegalName ?? prospect.user.fullName} />
              <Row label="Email" value={prospect.user.email} />
              <Row label="Nationality" value={map.nationality} />
              <Row label="Residence" value={map.residenceCountry} />
              <Row label="Date of Birth" value={map.dateOfBirth?.slice(0, 10)} />
              <Row label="Phone" value={prospect.user.phone ?? "—"} />
              <Row label="Address" value={map.address} />
            </dl>
          </Card>

          <Card title="Business Intent">
            <dl className="dl">
              <Row label="Activity Description" value={map.businessDescription} />
              <Row label="Expected Turnover" value={map.expectedTurnover} />
              <Row label="Timeline" value={pretty(map.timeline)} />
              <Row label="Source" value={pretty(map.source)} />
              <Row label="Services" value={services.map(pretty).join(", ")} />
            </dl>
          </Card>

          <Card title="Service Specifics">
            <dl className="dl">
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
            </dl>
          </Card>

          <Card title="Uploaded Documents">
            {prospect.documents.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>No documents uploaded.</p>
            ) : (
              prospect.documents.map((d) => (
                <a
                  key={d.id}
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="file-row"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="fic"><Icon name="documents" className="ic-16" /></div>
                  <div>
                    <div className="fname">{d.originalName}</div>
                    <div className="fmeta">{formatSize(d.sizeBytes)}</div>
                  </div>
                  <div className="fx">
                    <span className={`badge ${docStatusClass(d.status)}`}>{prettyDocStatus(d.status)}</span>
                  </div>
                </a>
              ))
            )}
          </Card>
        </div>

        <div>
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
        </div>
      </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4">
      <h3 className="card-title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === "") return null;
  const str = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <>
      <dt>{label}</dt>
      <dd>{str}</dd>
    </>
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
