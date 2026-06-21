import Link from "next/link";
import { bucketDocument, BUCKET_KYC, BUCKET_CORRESPONDENCE } from "@/lib/services/documents-bucket";
import { FolderSection, type DocRequestRow } from "./FolderSection";
import type { DocRowProps } from "./DocumentRow";

export type DocRow = DocRowProps & {
  serviceTypeKey: string | null;
  purpose: "passport" | "proof_of_address" | "sof" | "other";
  partyId: string | null;
};

export function DocumentsSection({
  clientId, documents, requests, services, taxonomy,
}: {
  clientId: string;
  documents: DocRow[];
  requests: DocRequestRow[];
  services: { serviceType: string }[];
  taxonomy: { key: string; label: string }[];
}) {
  const humanize = (key: string) =>
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const labelFor = (key: string) => {
    if (key === BUCKET_KYC) return "KYC Documents";
    if (key === BUCKET_CORRESPONDENCE) return "Correspondence";
    return taxonomy.find((t) => t.key === key)?.label ?? humanize(key);
  };

  const folderKeys = Array.from(
    new Set<string>([
      BUCKET_KYC,
      ...services.map((s) => s.serviceType),
      BUCKET_CORRESPONDENCE,
    ]),
  );

  const docsByFolder = new Map<string, DocRowProps[]>();
  for (const d of documents) {
    const key = bucketDocument({ purpose: d.purpose, partyId: d.partyId, serviceTypeKey: d.serviceTypeKey });
    if (!docsByFolder.has(key)) docsByFolder.set(key, []);
    docsByFolder.get(key)!.push({
      id: d.id, originalName: d.originalName, mime: d.mime,
      sizeBytes: d.sizeBytes, status: d.status, uploadedAt: d.uploadedAt,
    });
  }

  const reqsByFolder = new Map<string, DocRequestRow[]>();
  for (const r of requests) {
    if (r.state !== "open") continue;
    const key = r.serviceTypeKey ?? BUCKET_CORRESPONDENCE;
    if (!reqsByFolder.has(key)) reqsByFolder.set(key, []);
    reqsByFolder.get(key)!.push(r);
  }

  return (
    <section className="mb-8">
      <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Documents</h2>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {folderKeys.map((key) => {
          const label = labelFor(key);
          const slug = slugify(label);
          const count = (docsByFolder.get(key) ?? []).length;
          return (
            <Link key={key} href={`#docs-${slug}`} className="bg-admin-surface border border-admin-border rounded-elem p-4 text-center hover:border-accent transition-colors">
              <div className="text-meta font-medium">{label}</div>
              <div className="text-[11px] text-admin-muted">{count} {count === 1 ? "file" : "files"}</div>
            </Link>
          );
        })}
      </div>

      {folderKeys.map((key) => (
        <FolderSection
          key={key}
          id={`docs-${slugify(labelFor(key))}`}
          clientId={clientId}
          folderKey={key}
          label={labelFor(key)}
          documents={docsByFolder.get(key) ?? []}
          openRequests={reqsByFolder.get(key) ?? []}
        />
      ))}
    </section>
  );
}

function slugify(s: string) {
  return s.replace(/\s+/g, "-").toLowerCase();
}
