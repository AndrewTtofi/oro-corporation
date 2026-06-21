"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ClientTab } from "./tabs";

const TABS: { key: ClientTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "documents", label: "Documents" },
  { key: "conversation", label: "Conversation" },
  { key: "activity", label: "Activity" },
];

export function ClientTabs({ active }: { active: ClientTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(tab: ClientTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="chips mb-10">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => go(t.key)}
            className={`chip ${isActive ? "active" : ""}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

