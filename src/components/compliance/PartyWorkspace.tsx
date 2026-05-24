import { IdvChecklist } from "./IdvChecklist";
import { ScreeningPanel } from "./ScreeningPanel";

export function PartyWorkspace({ party }: {
  party: {
    id: string;
    fullName: string;
    role: string;
    type: string;
    kycCase: {
      id: string;
      idvStatus: string;
      passportDocId: string | null;
      proofOfAddressDocId: string | null;
      sofDocId: string | null;
      latestScreeningRun: null | { id: string; outcome: string; ranAt: string; hits: { id: string; matchedName: string; matchedTopics: string[]; matchScore: number; reviewStatus: string; matchUrl: string | null }[] };
    } | null;
  };
}) {
  return (
    <div className="grid lg:grid-cols-[2fr_3fr] gap-6">
      <section className="bg-admin-surface border border-admin-border rounded-card p-4">
        <h3 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Documents</h3>
        <DocSlot label="Passport"            id={party.kycCase?.passportDocId} />
        <DocSlot label="Proof of address"    id={party.kycCase?.proofOfAddressDocId} />
        <DocSlot label="Source of funds"     id={party.kycCase?.sofDocId} collapsed />
      </section>
      <div className="flex flex-col gap-6">
        <IdvChecklist partyId={party.id} kycCaseStatus={party.kycCase?.idvStatus ?? "pending"} />
        <ScreeningPanel partyId={party.id} latest={party.kycCase?.latestScreeningRun ?? null} />
      </div>
    </div>
  );
}

function DocSlot({ label, id, collapsed }: { label: string; id: string | null | undefined; collapsed?: boolean }) {
  if (!id) {
    return <div className="border border-dashed border-admin-border rounded-elem p-4 mb-3 text-meta text-admin-muted">{label}: not uploaded</div>;
  }
  return (
    <details open={!collapsed} className="border border-admin-border rounded-elem p-2 mb-3">
      <summary className="cursor-pointer text-meta font-semibold">{label}</summary>
      <iframe src={`/app/documents/${id}`} className="w-full h-[480px] mt-2 bg-admin-bg" />
    </details>
  );
}
