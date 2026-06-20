import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance review queue" };

const KIND_META: Record<
  string,
  { title: string; blurb: string }
> = {
  screening_hit: {
    title: "New sanctions hits to review",
    blurb:
      "A periodic re-screen surfaced names that may match a sanctions or PEP list. Clear false positives or escalate confirmed matches.",
  },
  risk_overdue: {
    title: "Annual risk reviews overdue",
    blurb:
      "These files have not been formally reviewed within their cadence (12 months by default). Re-confirm risk rating and sign off.",
  },
  info_missing: {
    title: "Information missing",
    blurb:
      "The file is incomplete — a party, document, or detail required for clearance has not been provided.",
  },
  document_expiring: {
    title: "Documents expiring soon",
    blurb:
      "A passport, proof-of-address, or certificate on file expires within 60 days. Request a refresh from the client.",
  },
};

const KIND_ORDER = ["screening_hit", "risk_overdue", "info_missing", "document_expiring"];

export default async function TasksPage() {
  await requireRole("staff");
  const tasks = await prisma.reviewTask.findMany({
    where: { state: "open" },
    include: {
      complianceFile: {
        include: {
          client: { include: { user: true } },
          prospect: { include: { user: true } },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  const grouped = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const k = t.kind as string;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(t);
  }

  return (
    <AdminShell active="compliance">
      {/* ─── Intro ────────────────────────────────────────────────── */}
      <section className="mb-12 max-w-[60ch]">
        <div className="eyebrow mb-2">Review Queue</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Compliance review queue</h2>
        <p className="mt-6 text-[15px] leading-[1.7] text-muted">
          This is the firm-wide work list. Each item is a flagged review created
          automatically by the system — usually because a screening turned up a
          new hit, an annual review fell due, a file is incomplete, or a
          document is about to expire. Click any row to open the affected
          compliance file and act on it.
        </p>
        <div className="mt-8 flex items-center gap-6 text-[13px] font-mono uppercase tracking-[0.18em]">
          <span className="text-muted">Open</span>
          <span className="figure text-ink">{tasks.length}</span>
        </div>
      </section>

      <hr className="hairline mb-12" />

      {/* ─── Empty state ──────────────────────────────────────────── */}
      {tasks.length === 0 && (
        <div className="surface px-12 py-16 text-center">
          <div style={{ fontSize: "1.953rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>
            All clear.
          </div>
          <p className="text-muted max-w-[44ch] mx-auto">
            No outstanding compliance reviews. New items appear here when
            screenings, periodic reviews, or document expiries flag a file.
          </p>
        </div>
      )}

      {/* ─── Grouped sections ─────────────────────────────────────── */}
      <div className="flex flex-col gap-12">
        {KIND_ORDER.filter((k) => grouped.has(k)).map((kind) => {
          const meta = KIND_META[kind];
          const items = grouped.get(kind) ?? [];
          if (!meta) return null;
          return (
            <section key={kind}>
              <header className="mb-6 flex items-baseline justify-between flex-wrap gap-4">
                <div className="max-w-[58ch]">
                  <h2
                    className="font-display text-[28px] leading-[1.15] tracking-[-0.02em] text-ink"
                    style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60' }}
                  >
                    {meta.title}
                  </h2>
                  <p className="mt-2 text-[14px] text-muted leading-relaxed">
                    {meta.blurb}
                  </p>
                </div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted figure">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </div>
              </header>

              <ul className="grid gap-px" style={{ background: "var(--admin-border)" }}>
                {items.map((t) => {
                  const file = t.complianceFile;
                  const subject =
                    file.client?.user?.fullName ??
                    file.prospect?.user?.fullName ??
                    "Unknown subject";
                  const reference =
                    file.client
                      ? file.client.companyName
                      : file.prospect?.referenceNumber ?? "—";
                  const link = file.clientId
                    ? `/admin/clients/${file.clientId}/compliance`
                    : `/admin/submissions/${file.prospect?.referenceNumber}/compliance`;
                  const due = t.dueAt ? new Date(t.dueAt) : null;
                  const overdue = due ? due.getTime() < Date.now() : false;
                  const ageDays = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86_400_000);
                  return (
                    <li key={t.id}>
                      <Link
                        href={link}
                        className="group flex items-center gap-8 px-8 py-6 bg-surface lift"
                        style={{ border: 0 }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-[20px] leading-[1.2] tracking-[-0.01em] text-ink truncate">
                            {subject}
                          </div>
                          <div className="mt-1 font-mono text-[11px] tracking-[0.12em] uppercase text-muted truncate">
                            {reference}
                          </div>
                        </div>

                        <div className="hidden md:block min-w-[120px]">
                          <div className="font-mono text-[9.5px] tracking-[0.24em] uppercase text-muted mb-1">
                            Created
                          </div>
                          <div className="figure text-[14px] text-ink">
                            {ageDays === 0 ? "today" : `${ageDays}d ago`}
                          </div>
                        </div>

                        <div className="hidden lg:block min-w-[140px]">
                          <div className="font-mono text-[9.5px] tracking-[0.24em] uppercase text-muted mb-1">
                            Due
                          </div>
                          <div className={`figure text-[14px] ${overdue ? "text-oxblood" : "text-ink"}`}>
                            {due ? due.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            {overdue && (
                              <span className="ml-2 font-mono text-[10px] tracking-[0.18em] uppercase">overdue</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-accent-deep group-hover:translate-x-1 transition-transform duration-500 inline-block">
                            Open →
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
