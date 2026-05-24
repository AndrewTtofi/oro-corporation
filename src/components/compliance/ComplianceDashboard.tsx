import { RiskPanel } from "./RiskPanel";
import { PartiesTable } from "./PartiesTable";
import { SignOffPanel } from "./SignOffPanel";
import { AddPartyModal } from "./AddPartyModal";

type Hit = { id: string; matchedName: string; matchedTopics: string[]; reviewStatus: string };
type KycCase = {
  id: string;
  state: "pending" | "in_progress" | "passed" | "blocked";
  latestScreeningRun: null | { id: string; outcome: "clear" | "hits" | "error"; hitCount: number; hits: Hit[] };
};
type Party = {
  id: string;
  role: string;
  fullName: string;
  type: string;
  kycCase: KycCase | null;
};
type File = {
  id: string;
  status: "open" | "in_review" | "cleared" | "blocked";
  riskComputed: string | null;
  riskComputedScore: number | null;
  riskRating: string | null;
  riskOverrideReason: string | null;
  signedOffAt: string | null;
  signedOffNote: string | null;
  parties: Party[];
  reviewTasks: { id: string; kind: string; dueAt: string | null; assignedTo: { fullName: string } | null }[];
};

export function ComplianceDashboard({ file, parentLink }: { file: File; parentLink: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="font-display text-2xl">Compliance file</h2>
          <p className="text-meta text-admin-muted mt-1">Status: <StatusBadge status={file.status} /></p>
        </div>
        <AddPartyModal complianceFileId={file.id} />
      </header>

      <RiskPanel
        fileId={file.id}
        computed={file.riskComputed}
        computedScore={file.riskComputedScore}
        rating={file.riskRating}
        overrideReason={file.riskOverrideReason}
      />

      <PartiesTable fileId={file.id} parties={file.parties} parentLink={parentLink} />

      {file.reviewTasks.length > 0 && (
        <section className="bg-admin-surface border border-admin-border rounded-card p-6">
          <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Open tasks</h3>
          <ul className="flex flex-col gap-2">
            {file.reviewTasks.map((t) => (
              <li key={t.id} className="text-meta">
                <span className="badge badge-pending mr-2">{t.kind.replace("_", " ")}</span>
                {t.dueAt && <span className="font-mono text-admin-muted">due {new Date(t.dueAt).toLocaleDateString()}</span>}
                {t.assignedTo && <span className="ml-3 text-admin-muted">@{t.assignedTo.fullName}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SignOffPanel
        fileId={file.id}
        status={file.status}
        riskRating={file.riskRating}
        signedOffAt={file.signedOffAt}
        signedOffNote={file.signedOffNote}
        parties={file.parties}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "cleared" ? "badge-approved" : status === "blocked" ? "badge-pending" : "badge-pending";
  return <span className={`badge ${cls} capitalize`}>{status.replace("_", " ")}</span>;
}
