import Link from "next/link";
import { AuthTabs } from "./AuthTabs";
import { getBranding } from "@/lib/services/branding";
import { BrandMark } from "@/components/BrandMark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { brandName, brandMark, logo } = await getBranding();
  return (
    <main className="shell-marketing auth-wrap">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="wordmark justify-center mb-8" style={{ justifyContent: "center" }}>
          <span className="seal" />
          <BrandMark logo={logo} mark={brandMark} />
          <span>{brandName}</span>
        </Link>

        <div className="auth-card">
          <div className="mb-6">
            <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Welcome back</h2>
            <p className="text-muted mt-1" style={{ fontSize: "0.875rem" }}>
              Sign in to access your engagements, documents and messages.
            </p>
          </div>

          <AuthTabs initial="signin" searchParamsPromise={searchParams} />

          <div className="divider">Secure sign-in</div>

          <p className="text-center text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.6 }}>
            By continuing you agree to our{" "}
            <Link href="/terms" className="text-brand">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="text-brand">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
