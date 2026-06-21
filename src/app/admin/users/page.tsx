import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { VerifyButton } from "./VerifyButton";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole("staff");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: [{ emailVerified: "asc" }, { createdAt: "desc" }],
  });

  const unverifiedCount = users.filter((u) => !u.emailVerified).length;

  return (
    <AdminShell active="users">
      <div className="mb-6">
        <div className="eyebrow mb-2">Firm</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Users</h2>
        <p className="muted mt-2" style={{ fontSize: "var(--fs-sm)" }}>
          {unverifiedCount > 0
            ? `${unverifiedCount} account${unverifiedCount === 1 ? "" : "s"} awaiting email verification.`
            : "All accounts have verified emails."}
        </p>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-toolbar"><strong>Users</strong><span className="muted right" style={{ fontSize: "var(--fs-xs)" }}>{users.length}</span></div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><span style={{ fontWeight: 600 }}>{u.fullName}</span></td>
                <td className="mono">{u.email}</td>
                <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                <td>
                  {u.emailVerified ? (
                    <span className="badge badge-approved">Verified</span>
                  ) : (
                    <span className="badge badge-pending">Pending</span>
                  )}
                </td>
                <td className="mono muted">
                  {u.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td>{u.emailVerified ? <span className="muted">—</span> : <VerifyButton userId={u.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
