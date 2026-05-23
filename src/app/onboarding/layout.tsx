import { Logo } from "@/components/marketing/Logo";
import { requireUser } from "@/lib/auth/guards";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell-client min-h-screen flex flex-col">
      <header className="border-b border-token bg-surface py-6">
        <div className="container flex items-center justify-between">
          <Logo />
          <div className="text-meta text-muted">
            Account: <span className="text-fg">{user.fullName ?? user.email}</span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
