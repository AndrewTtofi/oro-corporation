import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  await requireRole("staff");
  return <>{children}</>;
}
