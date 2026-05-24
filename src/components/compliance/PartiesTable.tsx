import Link from "next/link";

export function PartiesTable({ fileId, parties, parentLink }: {
  fileId: string;
  parties: { id: string; role: string; fullName: string; type: string; kycCase: { state: string; latestScreeningRun: null | { outcome: string; hitCount: number } } | null }[];
  parentLink: string;
}) {
  return (
    <section className="bg-admin-surface border border-admin-border rounded-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ background: "#FDFDFD" }}>
            <Th>Party</Th><Th>Role</Th><Th>Type</Th><Th>KYC state</Th><Th>Latest screening</Th><Th>{""}</Th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id} className="border-t border-admin-border">
              <Td className="font-semibold">{p.fullName}</Td>
              <Td>{p.role.replace("_", " ")}</Td>
              <Td>{p.type}</Td>
              <Td><span className="badge badge-pending">{p.kycCase?.state ?? "—"}</span></Td>
              <Td>{p.kycCase?.latestScreeningRun
                ? `${p.kycCase.latestScreeningRun.outcome} (${p.kycCase.latestScreeningRun.hitCount})`
                : "not run"}</Td>
              <Td><Link href={`${parentLink}/parties/${p.id}`} className="text-meta underline">Open</Link></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="text-left p-4 text-[11px] uppercase tracking-widest text-admin-muted font-semibold">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`p-4 align-middle text-meta ${className}`}>{children}</td>; }
