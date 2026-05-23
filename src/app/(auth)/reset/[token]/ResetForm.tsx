"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ResetForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: formData.get("password") }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "We couldn't reset your password. Try again.");
        return;
      }
      router.push("/login?reset=ok");
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
    >
      {error && (
        <div className="rounded-elem p-3 text-meta" style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-meta font-medium text-muted">New password</label>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary px-7 py-3.5 disabled:opacity-50">
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
