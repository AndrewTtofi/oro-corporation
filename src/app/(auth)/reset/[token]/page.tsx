import { Logo } from "@/components/marketing/Logo";
import { ResetForm } from "./ResetForm";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen grid place-items-center p-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-10"><Logo size="lg" /></div>
        <div className="surface rounded-card p-10 shadow-card-soft">
          <h1 className="font-display text-2xl mb-2">Set a new password</h1>
          <p className="text-muted text-meta mb-6">
            Choose a password of at least 8 characters.
          </p>
          <ResetForm token={token} />
        </div>
      </div>
    </main>
  );
}
