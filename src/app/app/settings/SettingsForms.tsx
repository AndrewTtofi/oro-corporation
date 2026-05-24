"use client";
import { useState, useTransition } from "react";

export function SettingsForms({
  initial,
}: {
  initial: { fullName: string; email: string; phone: string; languagePref: "en" | "ru" };
}) {
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function saveProfile(fd: FormData) {
    setProfileMsg(null);
    start(async () => {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fd.get("fullName"),
          phone: fd.get("phone"),
          languagePref: fd.get("languagePref"),
        }),
      });
      setProfileMsg(res.ok ? "Saved" : "Could not save");
    });
  }

  async function changePassword(fd: FormData) {
    setPwdMsg(null);
    start(async () => {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: fd.get("currentPassword"),
          newPassword: fd.get("newPassword"),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setPwdMsg(res.ok ? "Password updated" : body.error ?? "Could not update");
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="surface rounded-card p-8 flex flex-col gap-6"
        onSubmit={(e) => { e.preventDefault(); saveProfile(new FormData(e.currentTarget)); }}
      >
        <h2 className="text-lg font-semibold">Profile</h2>
        <Field label="Full name">
          <input className="input" name="fullName" defaultValue={initial.fullName} required />
        </Field>
        <Field label="Email" hint="Email cannot be changed here. Contact support to update.">
          <input className="input" name="email" defaultValue={initial.email} disabled />
        </Field>
        <Field label="Phone number">
          <input className="input" name="phone" defaultValue={initial.phone} placeholder="+357 99 123 456" />
        </Field>
        <Field label="Preferred language">
          <select className="select" name="languagePref" defaultValue={initial.languagePref}>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </Field>
        <div className="flex items-center justify-between">
          <div className="text-meta text-muted">{profileMsg}</div>
          <button type="submit" disabled={pending} className="btn btn-primary px-6 py-3 disabled:opacity-50">
            Save changes
          </button>
        </div>
      </form>

      <form
        className="surface rounded-card p-8 flex flex-col gap-6"
        onSubmit={(e) => { e.preventDefault(); changePassword(new FormData(e.currentTarget)); }}
      >
        <h2 className="text-lg font-semibold">Password</h2>
        <Field label="Current password">
          <input className="input" name="currentPassword" type="password" required autoComplete="current-password" />
        </Field>
        <Field label="New password" hint="Minimum 8 characters.">
          <input className="input" name="newPassword" type="password" minLength={8} required autoComplete="new-password" />
        </Field>
        <div className="flex items-center justify-between">
          <div className="text-meta text-muted">{pwdMsg}</div>
          <button type="submit" disabled={pending} className="btn btn-primary px-6 py-3 disabled:opacity-50">
            Update password
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-meta font-semibold">{label}</label>
      {hint && <p className="text-[12px] text-muted -mt-1">{hint}</p>}
      {children}
    </div>
  );
}
