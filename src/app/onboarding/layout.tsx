import { Logo } from "@/components/marketing/Logo";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { computeCompleteness } from "@/lib/services/prospect-intel";
import { CompletenessChip } from "@/components/admin/CompletenessChip";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Live "brief completeness" meter — mirrors what staff will see, so the
  // applicant knows how strong their application is as they fill it in.
  const prospect = await prisma.prospect.findUnique({
    where: { userId: user.id },
    include: { documents: true },
  });
  const completeness = prospect
    ? computeCompleteness({
        services: Array.isArray(prospect.servicesSelected) ? (prospect.servicesSelected as string[]) : [],
        answers: (prospect.draft as Record<string, unknown> | null) ?? {},
        docCount: prospect.documents.length,
      })
    : null;

  return (
    <div className="shell-client min-h-screen flex flex-col">
      <header className="border-b border-token bg-surface py-6">
        <div className="container flex items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-5">
            {completeness && (
              <span className="flex items-center gap-2 text-meta text-muted">
                <span className="text-[11px] uppercase tracking-widest">Brief</span>
                <CompletenessChip value={completeness} />
              </span>
            )}
            <div className="text-meta text-muted">
              Account: <span className="text-fg">{user.fullName ?? user.email}</span>
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
