import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { verifyEmailByToken } from "@/lib/services/auth-flows";

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyEmailByToken(token);
  const ok = result.ok;
  const expired = !ok && (result.reason === "EXPIRED");

  return (
    <main className="min-h-screen grid place-items-center p-10">
      <div className="w-full max-w-[480px] text-center">
        <div className="mb-10"><Logo size="lg" /></div>
        <div className="surface rounded-card p-10 shadow-card-soft">
          {ok ? (
            <>
              <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-6 text-2xl animate-scale-in"
                   style={{ background: "var(--accent)", color: "var(--dark)" }}>✓</div>
              <h1 className="font-display text-3xl mb-3">Email verified</h1>
              <p className="text-muted mb-8">Welcome. Sign in to continue your onboarding.</p>
              <Link href="/login" className="btn btn-primary px-7 py-3.5">Sign in</Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-6 text-2xl"
                   style={{ background: "rgba(220,38,38,0.1)", color: "#DC2626" }}>!</div>
              <h1 className="font-display text-3xl mb-3">
                {expired ? "Link expired" : "Invalid link"}
              </h1>
              <p className="text-muted mb-8">
                {expired
                  ? "This verification link has expired. Sign in and we'll send you a new one."
                  : "We couldn't verify this link. Please sign in to request a new email."}
              </p>
              <Link href="/login" className="btn btn-primary px-7 py-3.5">Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
