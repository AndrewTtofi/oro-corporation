import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";

export default function VerifySentPage() {
  return (
    <main className="min-h-screen grid place-items-center p-10">
      <div className="w-full max-w-[480px] text-center">
        <div className="mb-10"><Logo size="lg" /></div>
        <div className="surface rounded-card p-10 shadow-card-soft">
          <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-6 text-2xl"
               style={{ background: "var(--accent)", color: "var(--dark)" }}>✓</div>
          <h1 className="font-display text-3xl mb-3">Check your inbox</h1>
          <p className="text-muted mb-8">
            We&apos;ve sent a verification link to your email. Click it to activate your
            account and continue with onboarding. The link expires in 24 hours.
          </p>
          <Link href="/login" className="btn btn-outline px-6 py-3 text-fg">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
