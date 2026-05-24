import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { getProspectForUser } from "@/lib/services/client-view";
import type { DocStatus } from "@prisma/client";

export const metadata = { title: "Documents" };

export default async function MyDocumentsPage() {
  const user = await requireUser();
  const prospect = await getProspectForUser(user.id);
  if (!prospect) redirect("/onboarding");
  const isApproved = prospect.status === "approved";

  return (
    <ClientShell active="documents" approved={isApproved}>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-10">
        <div>
          <p className="eyebrow mb-2">Documents</p>
          <h1 className="font-display text-3xl">Your uploaded files</h1>
          <p className="text-muted mt-2 text-meta">Encrypted at rest, accessible only to authorized ORO staff and assigned partners.</p>
        </div>
        <Link href="/onboarding/documents" className="btn btn-outline px-5 py-2.5">Upload additional</Link>
      </div>

      <div className="surface rounded-card overflow-hidden max-w-[1000px]">
        <table className="w-full">
          <thead>
            <tr style={{ background: "#FDFDFD" }}>
              <Th>Type</Th>
              <Th>File</Th>
              <Th>Size</Th>
              <Th>Status</Th>
              <Th>Uploaded</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {prospect.documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-muted text-meta">
                  No documents uploaded yet.
                </td>
              </tr>
            ) : prospect.documents.map((d) => (
              <tr key={d.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <Td>{prettyType(d.type)}</Td>
                <Td className="font-medium">{d.originalName}</Td>
                <Td>{formatSize(d.sizeBytes)}</Td>
                <Td><span className={`badge ${statusClass(d.status)}`}>{prettyStatus(d.status)}</span></Td>
                <Td className="font-mono text-meta text-muted">{d.uploadedAt.toLocaleDateString("en-GB")}</Td>
                <Td className="text-right">
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="text-accent text-meta font-semibold">View</a>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ClientShell>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-muted font-semibold">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`p-4 text-meta ${className}`}>{children}</td>;
}
function prettyType(t: string) {
  return t === "passport" ? "Passport / ID" : t === "proof_of_address" ? "Proof of Address" : "Other";
}
function prettyStatus(s: DocStatus) {
  return s === "received" ? "Received"
       : s === "under_review" ? "Under Review"
       : s === "approved" ? "Approved"
       : "Re-upload Needed";
}
function statusClass(s: DocStatus) {
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
