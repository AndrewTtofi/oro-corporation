"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings",          label: "Organization" },
  { href: "/admin/settings/branding", label: "Branding & plan" },
  { href: "/admin/settings/services", label: "Services" },
  { href: "/admin/settings/team",     label: "Team" },
  { href: "/admin/settings/flags",    label: "Feature flags" },
];

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-6 border-b border-admin-border mb-8">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`pb-3 text-meta font-semibold border-b-2 -mb-px ${
              active ? "text-dark border-accent" : "text-admin-muted border-transparent hover:text-dark"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
