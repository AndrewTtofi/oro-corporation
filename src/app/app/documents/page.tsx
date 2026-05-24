import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { bucketDocument, BUCKET_KYC, BUCKET_CORRESPONDENCE } from "@/lib/services/documents-bucket";
import { RequestsBlock, type ReqRow } from "./RequestsBlock";
import { ClientFolderBlock, type ClientDocRow } from "./ClientFolderBlock";
import { ArbitraryUploadModal } from "./ArbitraryUploadModal";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function MyDocumentsPage() {
  const user = await requireUser();
  const [prospect, client] = await Promise.all([
    prisma.prospect.findUnique({ where: { userId: user.id }, include: { documents: { orderBy: { uploadedAt: "desc" } } } }),
    prisma.client.findUnique({
      where: { userId: user.id },
      include: { services: true, documentRequests: { where: { state: "open" }, orderBy: { createdAt: "desc" } } },
    }),
  ]);
  if (!prospect) redirect("/onboarding");
  const isApproved = prospect.status === "approved" || !!client;

  const taxonomy = client ? await prisma.service.findMany({ where: { active: true }, select: { key: true, label: true }, orderBy: { sortOrder: "asc" } }) : [];
  const labelFor = (key: string) => {
    if (key === BUCKET_KYC) return "KYC Documents";
    if (key === BUCKET_CORRESPONDENCE) return "Correspondence";
    return taxonomy.find((t) => t.key === key)?.label ?? key;
  };
  const folderKeys = [BUCKET_KYC, ...(client?.services.map((s) => s.serviceType) ?? []), BUCKET_CORRESPONDENCE];

  const byFolder = new Map<string, ClientDocRow[]>();
  for (const d of prospect.documents) {
    const k = bucketDocument({ purpose: d.purpose, partyId: d.partyId, serviceTypeKey: d.serviceTypeKey });
    if (!byFolder.has(k)) byFolder.set(k, []);
    byFolder.get(k)!.push({
      id: d.id, originalName: d.originalName, mime: d.mime, sizeBytes: d.sizeBytes,
      status: d.status, uploadedAt: d.uploadedAt,
    });
  }

  const requests: ReqRow[] = (client?.documentRequests ?? []).map((r) => ({
    id: r.id, description: r.description, serviceTypeKey: r.serviceTypeKey, dueAt: r.dueAt,
  }));

  const arbitraryFolders = [
    { key: null, label: "General correspondence" },
    ...(client?.services.map((s) => ({ key: s.serviceType, label: taxonomy.find((t) => t.key === s.serviceType)?.label ?? s.serviceType })) ?? []),
  ];

  return (
    <ClientShell active="documents" approved={isApproved}>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-10">
        <div>
          <p className="eyebrow mb-2">Documents</p>
          <h1 className="font-display text-3xl">Your documents</h1>
          <p className="text-muted mt-2 text-meta">Encrypted at rest, accessible only to authorized ORO staff and assigned partners.</p>
          <p className="text-muted mt-2 text-meta">Documents you upload are kept for audit. Contact your account manager if a document needs to be removed.</p>
        </div>
        {client && <ArbitraryUploadModal folders={arbitraryFolders} />}
      </div>

      {client && <RequestsBlock requests={requests} />}

      {client ? folderKeys.map((k) => (
        <ClientFolderBlock key={k} id={`docs-${slugify(labelFor(k))}`} label={labelFor(k)} documents={byFolder.get(k) ?? []} />
      )) : (
        <ClientFolderBlock id="docs-uploaded" label="Your uploaded files" documents={Array.from(byFolder.values()).flat()} />
      )}
    </ClientShell>
  );
}

function slugify(s: string) { return s.replace(/\s+/g, "-").toLowerCase(); }
