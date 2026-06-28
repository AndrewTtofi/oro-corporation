import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const metadata = { title: "My application" };

export default async function MyApplicationPage() {
  const user = await requireUser();
  const prospect = await prisma.prospect.findUnique({
    where: { userId: user.id },
    include: { details: true },
  });
  if (!prospect) redirect("/onboarding");
  const isApproved = prospect.status === "approved";
  const client = await prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } });

  const map = Object.fromEntries(prospect.details.map((d) => [d.fieldName, d.fieldValue]));

  return (
    <ClientShell active="application" approved={isApproved}>
      {client && (
        <div className="mb-6 p-3 rounded-elem bg-[var(--client-bg)] text-meta text-muted">
          This is your original submission. For your current service status, see your <Link href="/app/dashboard" className="underline">Dashboard</Link>.
        </div>
      )}
      <div className="flex justify-between items-end mb-10 flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-2">Application</p>
          <h1 className="font-display text-3xl">{prospect.referenceNumber}</h1>
        </div>
        {prospect.status === "pending" && (
          <Link href="/onboarding/details" className="btn btn-outline px-5 py-2.5">Edit draft</Link>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 max-w-[1100px]">
        <DetailSection
          title="Personal Information"
          rows={[
            { label: "Full legal name", value: map.fullLegalName ?? user.fullName },
            { label: "Date of birth", value: map.dateOfBirth?.slice(0, 10) },
            { label: "Nationality", value: map.nationality },
            { label: "Residence", value: map.residenceCountry },
            { label: "Address", value: map.address, multiline: true },
          ]}
        />

        <DetailSection
          title="Business Intent"
          rows={[
            { label: "Business description", value: map.businessDescription, multiline: true },
            { label: "Expected turnover", value: map.expectedTurnover },
            { label: "Timeline", value: pretty(map.timeline) },
            { label: "Source", value: pretty(map.source) },
          ]}
        />

        <Section title="Services Selected">
          <p className="text-meta">
            {Array.isArray(prospect.servicesSelected) && (prospect.servicesSelected as string[]).length
              ? (prospect.servicesSelected as string[]).map(prettyService).join(", ")
              : <span className="text-muted">No services selected yet.</span>}
          </p>
        </Section>

        <DetailSection
          title="Service Specifics"
          rows={[
            { label: "Proposed company name", value: map.proposedCompanyName },
            { label: "Business activity", value: map.businessActivity },
            { label: "Shareholders", value: map.shareholderCount },
            { label: "Nominee services", value: map.nomineeServices },
            { label: "Permit type", value: pretty(map.permitType) },
            { label: "Family members", value: map.familyCount },
            { label: "License type", value: map.licenseType },
            { label: "Account purpose", value: map.accountPurpose },
          ]}
        />
      </div>
    </ClientShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-card p-8">
      <h2 className="text-lg font-semibold mb-6">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

type DetailRow = { label: string; value?: string | number | null; multiline?: boolean };

function DetailSection({ title, rows }: { title: string; rows: DetailRow[] }) {
  const present = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== "");
  return (
    <Section title={title}>
      {present.length === 0 ? (
        <p className="text-meta text-muted">Not provided yet.</p>
      ) : (
        present.map((r) => (
          <div key={r.label}>
            <div className="text-[12px] uppercase tracking-widest text-muted mb-1 font-semibold">{r.label}</div>
            <div className={`text-meta ${r.multiline ? "leading-relaxed" : ""}`}>{String(r.value)}</div>
          </div>
        ))
      )}
    </Section>
  );
}

function prettyService(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function pretty(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
