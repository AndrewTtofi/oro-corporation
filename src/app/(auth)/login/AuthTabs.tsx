"use client";

import { useState, useTransition, use, useEffect } from "react";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "signin" | "signup";

const COUNTRY_CODES = ["+357", "+44", "+972", "+30", "+971", "+7", "+1"];

export function AuthTabs({
  initial,
  searchParamsPromise,
}: {
  initial: Tab;
  searchParamsPromise: Promise<{ next?: string; error?: string }>;
}) {
  const searchParams = use(searchParamsPromise);
  const [tab, setTab] = useState<Tab>(initial);
  const [error, setError] = useState<string | null>(searchParams.error ?? null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const explicitNext = searchParams.next;

  async function landingForRole(): Promise<string> {
    if (explicitNext) return explicitNext;
    const s = await getSession();
    switch (s?.user?.role) {
      case "staff": return "/admin";
      case "partner": return "/partner";
      case "client": return "/app";
      default: return "/onboarding";
    }
  }

  useEffect(() => { setError(null); }, [tab]);

  async function onSignIn(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
      if (!res || res.error) {
        setError(
          res?.error === "EMAIL_NOT_VERIFIED"
            ? "Please verify your email — check your inbox for the link."
            : "Invalid email or password.",
        );
        return;
      }
      router.push(await landingForRole());
      router.refresh();
    });
  }

  async function onSignUp(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          email: formData.get("email"),
          phoneCountry: formData.get("phoneCountry"),
          phoneNumber: formData.get("phoneNumber"),
          password: formData.get("password"),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Registration failed. Please try again.");
        return;
      }
      // Dev auto-verifies; try to sign in immediately. If that fails (prod
      // requires the email link), fall through to the verify-sent page.
      const signin = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
      if (signin && !signin.error) {
        router.push("/onboarding");
        router.refresh();
        return;
      }
      router.push("/verify-sent");
    });
  }

  return (
    <>
      <div className="auth-tabs">
        <button type="button" onClick={() => setTab("signin")} className={tab === "signin" ? "active" : ""}>Sign in</button>
        <button type="button" onClick={() => setTab("signup")} className={tab === "signup" ? "active" : ""}>Create account</button>
      </div>

      {error && (
        <div
          className="mb-5 px-4 py-3 flex items-start gap-3"
          style={{
            background: "var(--danger-tint)",
            color: "var(--danger)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8125rem",
          }}
          role="alert"
        >
          <span>{error}</span>
        </div>
      )}

      {tab === "signin" ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => { e.preventDefault(); onSignIn(new FormData(e.currentTarget)); }}
        >
          <Field label="Email Address">
            <input name="email" type="email" required autoComplete="email" placeholder="e.g. alex@example.com" className="input" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="flabel" style={{ marginBottom: 0 }}>Password</span>
              <Link href="/forgot" className="text-brand" style={{ fontSize: "0.75rem" }}>Forgot?</Link>
            </div>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary w-full mt-3 disabled:opacity-50">
            {pending ? "Signing in…" : "Sign In →"}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => { e.preventDefault(); onSignUp(new FormData(e.currentTarget)); }}
        >
          <Field label="Full Name">
            <input name="fullName" type="text" required autoComplete="name" placeholder="Legal name as on passport" className="input" />
          </Field>
          <Field label="Email Address">
            <input name="email" type="email" required autoComplete="email" className="input" />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="flabel">Telephone</span>
            <div className="flex gap-2">
              <select name="phoneCountry" className="input figure" style={{ width: 110, padding: "12px" }} defaultValue="+357">
                {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input name="phoneNumber" type="tel" inputMode="numeric" pattern="\d{4,15}" required className="input figure" />
            </div>
          </div>
          <Field label="Password">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
          <button type="submit" disabled={pending} className="btn btn-primary w-full mt-3 disabled:opacity-50">
            {pending ? "Creating account…" : "Create Account →"}
          </button>
        </form>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flabel">{label}</label>
      {children}
    </div>
  );
}
