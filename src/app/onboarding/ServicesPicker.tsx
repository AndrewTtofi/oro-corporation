"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ServiceIcons, SERVICES, type ServiceKey as IconKey } from "@/components/marketing/ServiceIcons";

const KEY_MAP: Record<IconKey, string> = {
  formation: "company_formation",
  accounting: "accounting",
  tax: "tax_residency",
  immigration: "immigration",
  licensing: "licensing",
  banking: "banking",
};

export function ServicesPicker({
  initialSelected,
  reference,
}: {
  initialSelected: string[];
  reference: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function onContinue() {
    if (selected.size === 0) return;
    start(async () => {
      const res = await fetch("/api/onboarding/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: Array.from(selected) }),
      });
      if (res.ok) router.push("/onboarding/details");
    });
  }

  return (
    <>
      <p className="text-center text-meta text-muted mb-6 font-mono">
        Application: <span className="text-fg">{reference}</span>
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const k = KEY_MAP[s.key];
          const isSel = selected.has(k);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(k)}
              aria-pressed={isSel}
              className={`relative text-left surface rounded-card p-8 flex flex-col gap-4 transition-all hover:-translate-y-0.5 ${
                isSel ? "ring-2" : ""
              }`}
              style={isSel ? { borderColor: "var(--accent)", boxShadow: "0 4px 12px rgba(200,164,90,0.1)" } : {}}
            >
              <span
                className="absolute top-4 right-4 w-6 h-6 rounded-full grid place-items-center text-xs border-2 transition-all"
                style={
                  isSel
                    ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--dark)" }
                    : { borderColor: "var(--border)", color: "transparent" }
                }
              >
                ✓
              </span>
              <span
                className="w-11 h-11 grid place-items-center rounded-elem transition-colors"
                style={
                  isSel
                    ? { background: "var(--dark)", color: "var(--accent)" }
                    : { background: "var(--bg)", color: "var(--fg)" }
                }
              >
                <span className="w-5 h-5 block">{ServiceIcons[s.key]}</span>
              </span>
              <h3 className="font-display text-xl">{s.title}</h3>
              <p className="text-meta text-muted">{s.pickerBlurb}</p>
            </button>
          );
        })}
      </div>

      <div className="border-t border-token mt-16 pt-10 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={selected.size === 0 || pending}
          className="btn btn-primary px-10 py-3.5 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Continue"}
        </button>
      </div>
    </>
  );
}
