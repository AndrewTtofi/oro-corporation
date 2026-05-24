import { Logo } from "@/components/marketing/Logo";
import { ForgotForm } from "./ForgotForm";
import Link from "next/link";

export default function ForgotPage() {
  return (
    <main className="min-h-screen grid place-items-center p-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-10"><Logo size="lg" /></div>
        <div className="surface rounded-card p-10 shadow-card-soft">
          <h1 className="font-display text-2xl mb-2">Reset your password</h1>
          <p className="text-muted text-meta mb-6">
            We&apos;ll email you a link to set a new password. The link expires in 1 hour.
          </p>
          <ForgotForm />
        </div>
        <p className="text-center mt-6 text-meta text-muted">
          Remembered it? <Link href="/login" className="underline text-fg">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
