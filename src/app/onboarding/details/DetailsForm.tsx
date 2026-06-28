"use client";

import { createContext, useContext, useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { personalAndIntentSchema, refineForSubmit } from "@/lib/schema/onboarding";

type Section = "personal" | "intent" | "specifics";

const COUNTRIES = [
  "Cyprus", "Russia", "United Kingdom", "Ireland", "Israel", "Greece",
  "United States", "United Arab Emirates", "Turkey", "Germany", "France",
  "Netherlands", "Switzerland", "China", "India", "Other",
];

// Which step a given field lives on, so a validation error can jump the user
// straight to the section that needs fixing.
const PERSONAL_FIELDS = ["fullLegalName", "dateOfBirth", "nationality", "residenceCountry", "address"];
const INTENT_FIELDS = ["businessDescription", "expectedTurnover", "timeline", "source"];
function sectionForField(field: string): Section {
  if (PERSONAL_FIELDS.includes(field)) return "personal";
  if (INTENT_FIELDS.includes(field)) return "intent";
  return "specifics";
}

const personalSchema = personalAndIntentSchema.pick({
  fullLegalName: true, dateOfBirth: true, nationality: true, residenceCountry: true, address: true,
});
const intentSchema = personalAndIntentSchema.pick({
  businessDescription: true, expectedTurnover: true, timeline: true, source: true,
});

// Per-field error messages, read by every <Field>/<Toggle> via context so the
// offending input can highlight itself without threading props through.
const FieldErrorContext = createContext<Record<string, string>>({});

export function DetailsForm({
  services,
  initialDraft,
  reference,
  userFullName,
  documentsPhase,
}: {
  services: string[];
  initialDraft: Record<string, unknown>;
  reference: string;
  userFullName: string;
  documentsPhase: "mandatory" | "optional" | "off";
}) {
  const [section, setSection] = useState<Section>("personal");
  const [draft, setDraft] = useState<Record<string, unknown>>({ fullLegalName: userFullName, ...initialDraft });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave 800ms after the last keystroke.
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void fetch("/api/onboarding/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }).then((r) => { if (r.ok) setSavedAt(new Date()); });
    }, 800);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [draft]);

  function set<K extends string>(field: K, value: unknown) {
    setDraft((d) => ({ ...d, [field]: value }));
    // Clear this field's error the moment the user edits it.
    setFieldErrors((fe) => {
      if (!fe[field]) return fe;
      const next = { ...fe };
      delete next[field];
      return next;
    });
  }

  // Friendly copy: an empty required field reads "This field is required";
  // a filled-but-invalid one keeps the schema's specific message.
  function friendly(field: string, schemaMsg: string): string {
    const v = draft[field];
    const empty = v === undefined || v === null || v === "";
    return empty ? "This field is required." : schemaMsg;
  }

  // Validate `draft` against a schema subset → { field: message }.
  function collectErrors(schema: typeof personalSchema | typeof intentSchema): Record<string, string> {
    const res = schema.safeParse(draft);
    const errs: Record<string, string> = {};
    if (!res.success) {
      for (const issue of res.error.issues) {
        const f = String(issue.path[0]);
        if (f && !errs[f]) errs[f] = friendly(f, issue.message);
      }
    }
    return errs;
  }

  // Highlight the bad fields, jump to the first offending section, and scroll
  // the first highlighted input into view.
  function showErrors(errs: Record<string, string>) {
    setFieldErrors(errs);
    setError("Please complete the highlighted fields.");
    const first = Object.keys(errs)[0];
    if (first) {
      setSection(sectionForField(first));
      setTimeout(() => {
        document.querySelector(".field-invalid")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
  }
  function g<K extends string>(field: K): string {
    const v = draft[field];
    return v === undefined || v === null ? "" : String(v);
  }
  function bool(field: string): boolean | undefined {
    const v = draft[field];
    return typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : undefined;
  }

  async function onContinue() {
    setError(null);
    setFieldErrors({});
    if (section === "personal") {
      const errs = collectErrors(personalSchema);
      if (Object.keys(errs).length) { showErrors(errs); return; }
      setSection("intent"); window.scrollTo(0, 0); return;
    }
    if (section === "intent") {
      const errs = collectErrors(intentSchema);
      if (Object.keys(errs).length) { showErrors(errs); return; }
      setSection("specifics"); window.scrollTo(0, 0); return;
    }
    // section === specifics → validate conditional requireds client-side first
    const refineErrs: Record<string, string> = {};
    for (const e of refineForSubmit({ ...draft, services } as never)) {
      if (!refineErrs[e.field]) refineErrs[e.field] = e.message;
    }
    if (Object.keys(refineErrs).length) { showErrors(refineErrs); return; }
    // → submit Step 2
    start(async () => {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, services }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        // Map any field-keyed server errors back onto the inputs.
        const errs: Record<string, string> = {};
        if (Array.isArray(body.error)) {
          for (const e of body.error as { message?: string; field?: string; path?: (string | number)[] }[]) {
            const f = e.field ?? (Array.isArray(e.path) ? String(e.path[0]) : undefined);
            if (f && !errs[f]) errs[f] = friendly(f, e.message ?? "This field is required.");
          }
        }
        if (Object.keys(errs).length) { showErrors(errs); return; }
        setError(typeof body.error === "string" ? body.error : "Please complete all required fields.");
        return;
      }
      // When the documents phase is disabled, step 2 is the final step:
      // finalise the application here instead of continuing to documents.
      if (documentsPhase === "off") {
        const fin = await fetch("/api/onboarding/submit", { method: "PUT" });
        if (!fin.ok) {
          const body = (await fin.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Submission failed");
          return;
        }
        router.push("/onboarding/success");
        return;
      }
      router.push("/onboarding/documents");
    });
  }

  function onBack() {
    if (section === "intent") setSection("personal");
    else if (section === "specifics") setSection("intent");
    else router.push("/onboarding");
  }

  function jump(target: Section) {
    setSection(target);
    window.scrollTo(0, 0);
  }

  return (
    <FieldErrorContext.Provider value={fieldErrors}>
    <div className="container max-w-[1200px] grid gap-16 lg:grid-cols-[240px_1fr] pb-24">
      <aside className="lg:sticky lg:top-32 self-start">
        <nav className="flex lg:flex-col gap-4 lg:gap-5">
          <SideLink label="Personal Information" active={section === "personal"} done={section !== "personal"} onClick={() => jump("personal")} />
          <SideLink label="Business Intent" active={section === "intent"} done={section === "specifics"} onClick={() => jump("intent")} />
          <SideLink label="Service Specifics" active={section === "specifics"} done={false} onClick={() => jump("specifics")} />
        </nav>
        <div className="mt-8 text-meta text-muted font-mono">
          Ref: <span className="text-fg">{reference}</span>
        </div>
      </aside>

      <main className="surface rounded-card p-10 lg:p-12">
        {section === "personal" && (
          <section>
            <h2 className="font-display text-2xl mb-8">Personal Information</h2>
            <div className="flex flex-col gap-8">
              <Field label="Full legal name (as shown on passport)" name="fullLegalName">
                <input className="input" value={g("fullLegalName")} onChange={(e) => set("fullLegalName", e.target.value)} />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Date of birth" name="dateOfBirth">
                  <input type="date" className="input" value={g("dateOfBirth").slice(0, 10)} onChange={(e) => set("dateOfBirth", e.target.value)} />
                </Field>
                <Field label="Nationality" name="nationality">
                  <select className="select" value={g("nationality")} onChange={(e) => set("nationality", e.target.value)}>
                    <option value="">Select…</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Country of current residence" name="residenceCountry">
                <select className="select" value={g("residenceCountry")} onChange={(e) => set("residenceCountry", e.target.value)}>
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Current address" name="address">
                <textarea className="textarea" placeholder="Street, Building, Apartment, City, Postal Code"
                          value={g("address")} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {section === "intent" && (
          <section>
            <h2 className="font-display text-2xl mb-8">Business Intent</h2>
            <div className="flex flex-col gap-8">
              <Field label="Brief description of your business activity" name="businessDescription"
                     hint="Minimum 100 characters. Describe what your company does or will do.">
                <textarea className="textarea" rows={5} value={g("businessDescription")}
                          onChange={(e) => set("businessDescription", e.target.value)} />
                <div className="text-meta text-muted text-right">{g("businessDescription").length} / 100</div>
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Expected annual turnover" name="expectedTurnover">
                  <select className="select" value={g("expectedTurnover")} onChange={(e) => set("expectedTurnover", e.target.value)}>
                    <option value="">Select…</option>
                    <option value="<50K">Under EUR 50K</option>
                    <option value="50K-200K">EUR 50K – 200K</option>
                    <option value="200K-500K">EUR 200K – 500K</option>
                    <option value="500K-1M">EUR 500K – 1M</option>
                    <option value="1M+">EUR 1M+</option>
                  </select>
                </Field>
                <Field label="Timeline to get started" name="timeline">
                  <select className="select" value={g("timeline")} onChange={(e) => set("timeline", e.target.value)}>
                    <option value="">Select…</option>
                    <option value="immediately">Immediately</option>
                    <option value="within_1_month">Within 1 month</option>
                    <option value="1_to_3_months">1 – 3 months</option>
                    <option value="exploring">Just exploring</option>
                  </select>
                </Field>
              </div>
              <Field label="How did you hear about us?" name="source">
                <select className="select" value={g("source")} onChange={(e) => set("source", e.target.value)}>
                  <option value="">Select…</option>
                  <option value="google">Google Search</option>
                  <option value="referral">Referral</option>
                  <option value="social">Social Media</option>
                  <option value="event">Event</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
          </section>
        )}

        {section === "specifics" && (
          <section>
            <h2 className="font-display text-2xl mb-2">Service Specifics</h2>
            <p className="text-muted mb-8">
              Based on your selection: {services.length ? services.map(formatService).join(" · ") : "—"}
            </p>
            <div className="flex flex-col gap-8">
              {services.includes("company_formation") && (
                <FieldGroup title="Company Formation">
                  <Field label="Proposed company name" name="proposedCompanyName">
                    <input className="input" placeholder="Desired name (subject to availability)"
                           value={g("proposedCompanyName")} onChange={(e) => set("proposedCompanyName", e.target.value)} />
                  </Field>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Number of shareholders" name="shareholderCount">
                      <input type="number" min={1} className="input" value={g("shareholderCount")}
                             onChange={(e) => set("shareholderCount", Number(e.target.value))} />
                    </Field>
                    <Toggle label="Need nominee services?" value={bool("nomineeServices")}
                            onChange={(v) => set("nomineeServices", v)} />
                  </div>
                  <Field label="Type of business activity (NACE category if known)">
                    <input className="input" placeholder="e.g. IT Services, Holding Company"
                           value={g("businessActivity")} onChange={(e) => set("businessActivity", e.target.value)} />
                  </Field>
                </FieldGroup>
              )}

              {services.includes("tax_residency") && (
                <FieldGroup title="Tax Residency">
                  <Field label="Current tax residency country" name="currentTaxResidency">
                    <select className="select" value={g("currentTaxResidency")} onChange={(e) => set("currentTaxResidency", e.target.value)}>
                      <option value="">Select…</option>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Toggle label="60+ days in Cyprus this year?" name="daysInCyprus60Plus" value={bool("daysInCyprus60Plus")}
                          onChange={(v) => set("daysInCyprus60Plus", v)} />
                  <Field label="Employment status">
                    <input className="input" value={g("employmentStatus")} onChange={(e) => set("employmentStatus", e.target.value)} />
                  </Field>
                </FieldGroup>
              )}

              {services.includes("immigration") && (
                <FieldGroup title="Immigration">
                  <Field label="Permit type" name="permitType">
                    <select className="select" value={g("permitType")} onChange={(e) => set("permitType", e.target.value)}>
                      <option value="">Select…</option>
                      <option value="work">Work permit</option>
                      <option value="pr">Permanent residency</option>
                      <option value="digital_nomad">Digital Nomad visa</option>
                    </select>
                  </Field>
                  <Field label="Family members count (excluding you)" name="familyCount">
                    <input type="number" min={0} className="input" value={g("familyCount")}
                           onChange={(e) => set("familyCount", Number(e.target.value))} />
                  </Field>
                </FieldGroup>
              )}

              {services.includes("accounting") && (
                <FieldGroup title="Accounting & VAT">
                  <Toggle label="Existing Cyprus company?" name="hasCyprusCompany" value={bool("hasCyprusCompany")}
                          onChange={(v) => set("hasCyprusCompany", v)} />
                  {bool("hasCyprusCompany") && (
                    <Field label="Registration number">
                      <input className="input" value={g("cyprusCompanyRegNumber")}
                             onChange={(e) => set("cyprusCompanyRegNumber", e.target.value)} />
                    </Field>
                  )}
                  <Field label="Accounting software (current or preferred)">
                    <input className="input" value={g("accountingSoftware")}
                           onChange={(e) => set("accountingSoftware", e.target.value)} />
                  </Field>
                  <Field label="Approximate monthly transaction volume">
                    <input className="input" placeholder="e.g. < 100, 100–500, 500+"
                           value={g("monthlyTxVolume")} onChange={(e) => set("monthlyTxVolume", e.target.value)} />
                  </Field>
                </FieldGroup>
              )}

              {services.includes("banking") && (
                <FieldGroup title="Banking Solutions">
                  <Field label="Account purpose" name="accountPurpose">
                    <input className="input" value={g("accountPurpose")} onChange={(e) => set("accountPurpose", e.target.value)} />
                  </Field>
                  <Field label="Expected monthly volume (EUR)">
                    <input className="input" value={g("expectedMonthlyVolume")}
                           onChange={(e) => set("expectedMonthlyVolume", e.target.value)} />
                  </Field>
                  <Field label="Main counterpart countries">
                    <input className="input" placeholder="Comma-separated"
                           value={g("counterpartCountries")} onChange={(e) => set("counterpartCountries", e.target.value)} />
                  </Field>
                </FieldGroup>
              )}

              {services.includes("licensing") && (
                <FieldGroup title="Licensing">
                  <Field label="License type (CySEC / CASP / EMI / Gambling / Other)" name="licenseType">
                    <input className="input" value={g("licenseType")} onChange={(e) => set("licenseType", e.target.value)} />
                  </Field>
                  <Field label="Current jurisdiction (if any)">
                    <input className="input" value={g("currentJurisdiction")}
                           onChange={(e) => set("currentJurisdiction", e.target.value)} />
                  </Field>
                  <Field label="Existing licenses (if any)">
                    <textarea className="textarea" value={g("existingLicenses")}
                              onChange={(e) => set("existingLicenses", e.target.value)} />
                  </Field>
                </FieldGroup>
              )}
            </div>
          </section>
        )}

        {error && (
          <div className="mt-8 rounded-elem p-4 text-meta" style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <div className="border-t border-token mt-12 pt-8 flex justify-between items-center gap-3 flex-wrap">
          <div className="text-meta text-muted">
            {savedAt ? `Saved ${formatRelative(savedAt)}` : "Drafts autosave as you type"}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="btn btn-ghost px-6 py-3">Back</button>
            <button type="button" onClick={onContinue} disabled={pending} className="btn btn-primary px-7 py-3 disabled:opacity-50">
              {section === "specifics"
                ? pending
                  ? "Submitting…"
                  : documentsPhase === "off"
                    ? "Submit application"
                    : "Continue to documents"
                : "Continue"}
            </button>
          </div>
        </div>
      </main>
    </div>
    </FieldErrorContext.Provider>
  );
}

function SideLink({ label, active, done, onClick }: { label: string; active: boolean; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left flex items-center gap-3 text-meta ${active ? "text-fg font-semibold" : done ? "text-fg" : "text-muted"}`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full inline-block border"
        style={
          active
            ? { background: "var(--accent)", borderColor: "var(--accent)" }
            : done
              ? { background: "var(--dark)", borderColor: "var(--dark)" }
              : { borderColor: "var(--border)" }
        }
      />
      {label}
    </button>
  );
}

function Field({ label, hint, name, children }: { label: string; hint?: string; name?: string; children: React.ReactNode }) {
  const errors = useContext(FieldErrorContext);
  const err = name ? errors[name] : undefined;
  return (
    <div className={`flex flex-col gap-2.5${err ? " field-invalid" : ""}`}>
      <label className="text-meta font-semibold">{label}</label>
      {hint && <p className="text-[12px] text-muted -mt-1">{hint}</p>}
      {children}
      {err && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-token pt-8">
      <div className="eyebrow mb-6">{title}</div>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

function Toggle({ label, name, value, onChange }: { label: string; name?: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  const errors = useContext(FieldErrorContext);
  const err = name ? errors[name] : undefined;
  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-meta font-semibold">{label}</label>
      <div className="flex gap-3">
        <button type="button" onClick={() => onChange(false)} aria-pressed={value === false}
                className="flex-1 px-4 py-3 rounded-elem text-meta font-medium border transition-all"
                style={value === false
                  ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--fg)" }
                  : { borderColor: "var(--border)" }}>No</button>
        <button type="button" onClick={() => onChange(true)} aria-pressed={value === true}
                className="flex-1 px-4 py-3 rounded-elem text-meta font-medium border transition-all"
                style={value === true
                  ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--fg)" }
                  : { borderColor: "var(--border)" }}>Yes</button>
      </div>
      {err && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

function formatService(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatRelative(d: Date): string {
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
