"use client";
import { useState, useTransition } from "react";

type ClientFields = {
  address: string | null;
  taxResidency: string | null;
  companyName: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  engagementLetterDate: string | null;
};

export function SettingsForms({
  initial,
  clientFields,
}: {
  initial: { fullName: string; email: string; phone: string; languagePref: "en" | "ru" };
  clientFields?: ClientFields | null;
}) {
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [companyMsg, setCompanyMsg] = useState<string | null>(null);
  // Separate transitions so submitting one form doesn't disable buttons on the others.
  const [profilePending, startProfile] = useTransition();
  const [companyPending, startCompany] = useTransition();
  const [pwdPending, startPwd] = useTransition();

  async function saveProfile(fd: FormData) {
    setProfileMsg(null);
    startProfile(async () => {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fd.get("fullName"),
          phone: fd.get("phone") || null,
          languagePref: fd.get("languagePref"),
        }),
      });
      setProfileMsg(res.ok ? "Saved" : "Could not save");
    });
  }

  async function saveCompany(fd: FormData) {
    setCompanyMsg(null);
    startCompany(async () => {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Empty string fails Zod's .length(2) on taxResidency — coerce to null
          // so clearing the field actually clears it.
          address: fd.get("address") || null,
          taxResidency: fd.get("taxResidency") || null,
        }),
      });
      setCompanyMsg(res.ok ? "Saved" : "Could not save");
    });
  }

  async function changePassword(fd: FormData) {
    setPwdMsg(null);
    startPwd(async () => {
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
          <button type="submit" disabled={profilePending} className="btn btn-primary px-6 py-3 disabled:opacity-50">
            Save changes
          </button>
        </div>
      </form>

      {clientFields && (
        <form
          className="surface rounded-card p-8 flex flex-col gap-6"
          onSubmit={(e) => { e.preventDefault(); saveCompany(new FormData(e.currentTarget)); }}
        >
          <h2 className="text-lg font-semibold">Company</h2>

          {/* Read-only fields */}
          <ReadOnlyField label="Company name" value={clientFields.companyName} />
          <ReadOnlyField label="Registration number" value={clientFields.registrationNumber} />
          <ReadOnlyField label="VAT number" value={clientFields.vatNumber} />
          <ReadOnlyField label="Engagement letter date" value={clientFields.engagementLetterDate} />
          <p className="text-[12px] text-muted -mt-2">
            Contact your account manager to change the above details.
          </p>

          {/* Editable fields */}
          <Field label="Registered address">
            <textarea
              className="input min-h-[80px] resize-y"
              name="address"
              defaultValue={clientFields.address ?? ""}
              placeholder="123 Example Street, Nicosia, Cyprus"
            />
          </Field>
          <Field label="Tax residency" hint="2-letter country code (e.g. CY, RU, GB).">
            <input
              className="input w-24"
              name="taxResidency"
              defaultValue={clientFields.taxResidency ?? ""}
              maxLength={2}
              placeholder="CY"
            />
          </Field>

          <div className="flex items-center justify-between">
            <div className="text-meta text-muted">{companyMsg}</div>
            <button type="submit" disabled={companyPending} className="btn btn-primary px-6 py-3 disabled:opacity-50">
              Save company details
            </button>
          </div>
        </form>
      )}

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
          <button type="submit" disabled={pwdPending} className="btn btn-primary px-6 py-3 disabled:opacity-50">
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

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-meta font-semibold">{label}</span>
      <span className="text-sm text-muted">{value ?? "—"}</span>
    </div>
  );
}
