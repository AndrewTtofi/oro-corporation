import { DocumentRow, type DocRowProps } from "./DocumentRow";
import { UploadButton } from "./UploadButton";
import { CancelRequestClient } from "./CancelRequestClient";
import { BUCKET_KYC, BUCKET_CORRESPONDENCE } from "@/lib/services/documents-bucket";

export type DocRequestRow = {
  id: string;
  description: string;
  serviceTypeKey: string | null;
  dueAt: string | null;
  state: "open" | "fulfilled" | "cancelled";
};

export function FolderSection({
  id, clientId, folderKey, label, documents, openRequests,
}: {
  id: string;
  clientId: string;
  folderKey: string;
  label: string;
  documents: DocRowProps[];
  openRequests: DocRequestRow[];
}) {
  const isKyc = folderKey === BUCKET_KYC;
  const isCorrespondence = folderKey === BUCKET_CORRESPONDENCE;
  const serviceTypeKey = isKyc || isCorrespondence ? null : folderKey;
  const defaultPurpose: "passport" | "proof_of_address" | "sof" | "other" = isKyc ? "passport" : "other";

  return (
    <section id={id} className="card mb-4 scroll-mt-24">
      <div className="row-between mb-3">
        <h3 className="card-title" style={{ marginBottom: 0 }}>{label} <span className="muted" style={{ fontWeight: 400 }}>({documents.length})</span></h3>
        <UploadButton clientId={clientId} serviceTypeKey={serviceTypeKey} defaultPurpose={defaultPurpose} />
      </div>

      {documents.length === 0 ? <p className="muted" style={{ fontSize: "0.875rem" }}>No documents yet.</p> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => <DocumentRow key={d.id} doc={d} />)}
            </tbody>
          </table>
        </div>
      )}

      {openRequests.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="eyebrow mb-2">Open requests</div>
          <ul className="flex flex-col gap-2">
            {openRequests.map((r) => (
              <li key={r.id} className="row-between" style={{ fontSize: "0.875rem" }}>
                <span>
                  {r.description}
                  {r.dueAt && <span className="ml-2 mono muted" style={{ fontSize: "0.75rem" }}>due {new Date(r.dueAt).toLocaleDateString()}</span>}
                </span>
                <CancelRequestClient id={r.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
