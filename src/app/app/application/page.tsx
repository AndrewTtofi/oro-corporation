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
        <Section title="Personal Information">
          <Row label="Full legal name" value={map.fullLegalName ?? user.fullName} />
          <Row label="Date of birth" value={map.dateOfBirth?.slice(0, 10)} />
          <Row label="Nationality" value={map.nationality} />
          <Row label="Residence" value={map.residenceCountry} />
          <Row label="Address" value={map.address} multiline />
        </Section>

        <Section title="Business Intent">
          <Row label="Business description" value={map.businessDescription} multiline />
          <Row label="Expected turnover" value={map.expectedTurnover} />
          <Row label="Timeline" value={pretty(map.timeline)} />
          <Row label="Source" value={pretty(map.source)} />
        </Section>

        <Section title="Services Selected">
          <p className="text-meta">
            {Array.isArray(prospect.servicesSelected) && (prospect.servicesSelected as string[]).length
              ? (prospect.servicesSelected as string[]).map(prettyService).join(", ")
              : "—"}
          </p>
        </Section>

        <Section title="Service Specifics">
          <Row label="Proposed company name" value={map.proposedCompanyName} />
          <Row label="Business activity" value={map.businessActivity} />
          <Row label="Shareholders" value={map.shareholderCount} />
          <Row label="Nominee services" value={map.nomineeServices} />
          <Row label="Permit type" value={pretty(map.permitType)} />
          <Row label="Family members" value={map.familyCount} />
          <Row label="License type" value={map.licenseType} />
          <Row label="Account purpose" value={map.accountPurpose} />
        </Section>
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

function Row({ label, value, multiline }: { label: string; value?: string | number | null; multiline?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div>
      <div className="text-[12px] uppercase tracking-widest text-muted mb-1 font-semibold">{label}</div>
      <div className={`text-meta ${multiline ? "leading-relaxed" : ""}`}>{String(value)}</div>
    </div>
  );
}

function prettyService(s: string) {
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function pretty(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
