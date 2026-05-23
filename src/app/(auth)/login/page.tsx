import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { AuthTabs } from "./AuthTabs";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <main className="min-h-screen grid place-items-center p-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-10">
          <Logo size="lg" />
        </div>
        <div className="surface rounded-card p-10 shadow-card-soft">
          <AuthTabs initial="signin" searchParamsPromise={searchParams} />
        </div>
        <p className="text-center mt-6 text-meta text-muted">
          By creating an account, you agree to our<br />
          <Link href="#" className="underline text-fg">Terms of Service</Link> and{" "}
          <Link href="#" className="underline text-fg">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
