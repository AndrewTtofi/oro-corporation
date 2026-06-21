import Link from "next/link";

export function ComplianceBar({
  clientId,
  status,
  riskRating,
}: {
  clientId: string;
  status: "open" | "in_review" | "cleared" | "blocked" | null;
  riskRating: "low" | "standard" | "high" | null;
}) {
  if (!status) return null;

  const statusLabel: Record<string, string> = {
    open: "Open",
    in_review: "In review",
    cleared: "Cleared",
    blocked: "Blocked",
  };

  const statusBadge: Record<string, string> = {
    open: "badge-pending",
    in_review: "badge-info",
    cleared: "badge-approved",
    blocked: "badge-rejected",
  };

  const riskBadge: Record<string, string> = {
    high: "badge-rejected",
    standard: "badge-pending",
    low: "badge-approved",
  };

  return (
    <section className="card row-between mb-10" style={{ flexWrap: "wrap", gap: "var(--space-4)" }}>
      <div className="row gap-3" style={{ flexWrap: "wrap" }}>
        <div className="eyebrow">Compliance file</div>
        <span className={`badge ${statusBadge[status]}`}><span className="bdot" />{statusLabel[status]}</span>
        {riskRating && (
          <span className="row gap-2">
            <span className="eyebrow">Risk</span>
            <span className={`badge ${riskBadge[riskRating]}`}>{riskRating}</span>
          </span>
        )}
      </div>

      <Link
        href={`/admin/clients/${clientId}/compliance`}
        className="btn btn-secondary btn-sm"
      >
        Open file →
      </Link>
    </section>
  );
}
