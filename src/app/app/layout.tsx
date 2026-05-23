import { requireUser } from "@/lib/auth/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth + role check is enforced by middleware; we still trigger the auth call so
  // server components can rely on it being cached for the request.
  await requireUser();
  return <>{children}</>;
}
