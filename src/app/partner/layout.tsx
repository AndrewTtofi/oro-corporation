import { requireRole } from "@/lib/auth/guards";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("partner");
  return <>{children}</>;
}
