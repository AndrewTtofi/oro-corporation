"use client";

import { useState, useTransition, use, useEffect } from "react";
import { signIn } from "next-auth/react";
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
  const nextPath = searchParams.next || "/onboarding";

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
      router.push(nextPath);
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
      router.push("/verify-sent");
    });
  }

  return (
    <>
      <div className="flex border-b border-token mb-8">
        <button
          type="button"
          onClick={() => setTab("signin")}
          className={`flex-1 text-center pb-3 text-[15px] font-semibold relative ${
            tab === "signin" ? "text-fg" : "text-muted"
          }`}
        >
          Sign In
          {tab === "signin" && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`flex-1 text-center pb-3 text-[15px] font-semibold relative ${
            tab === "signup" ? "text-fg" : "text-muted"
          }`}
        >
          Create Account
          {tab === "signup" && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-elem p-3 text-meta" style={{ background: "rgba(220, 38, 38, 0.08)", color: "#DC2626" }} role="alert">
          {error}
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-meta font-medium text-muted">Password</span>
              <Link href="/forgot" className="text-[13px]" style={{ color: "var(--accent)" }}>Forgot password?</Link>
            </div>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary px-7 py-3.5 mt-2 disabled:opacity-50">
            {pending ? "Signing in…" : "Sign In"}
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
            <span className="text-meta font-medium text-muted">Phone Number</span>
            <div className="flex gap-2">
              <select name="phoneCountry" className="input" style={{ width: 110, padding: "12px" }} defaultValue="+357">
                {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input name="phoneNumber" type="tel" inputMode="numeric" pattern="\d{4,15}" required className="input" />
            </div>
          </div>
          <Field label="Password">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
          <button type="submit" disabled={pending} className="btn btn-primary px-7 py-3.5 mt-2 disabled:opacity-50">
            {pending ? "Creating account…" : "Create Account"}
          </button>
        </form>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-meta font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
