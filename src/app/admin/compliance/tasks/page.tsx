import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance tasks" };

export default async function TasksPage() {
  await requireRole("staff");
  const tasks = await prisma.reviewTask.findMany({
    where: { state: "open" },
    include: { complianceFile: { include: { client: true, prospect: true } } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return (
    <AdminShell active="compliance">
      <h1 className="font-display text-3xl mb-6">Compliance tasks</h1>
      <ul className="flex flex-col gap-2">
        {tasks.map((t) => {
          const link = t.complianceFile.clientId
            ? `/admin/clients/${t.complianceFile.clientId}/compliance`
            : `/admin/submissions/${t.complianceFile.prospect?.referenceNumber}/compliance`;
          return (
            <li key={t.id} className="border border-admin-border rounded-elem p-3 flex justify-between">
              <div>
                <span className="badge badge-pending mr-2">{t.kind.replace("_", " ")}</span>
                {t.dueAt && <span className="font-mono text-meta">due {new Date(t.dueAt).toLocaleDateString()}</span>}
              </div>
              <Link href={link} className="text-meta underline">Open</Link>
            </li>
          );
        })}
        {tasks.length === 0 && <p className="text-meta text-admin-muted">No open compliance tasks.</p>}
      </ul>
    </AdminShell>
  );
}
