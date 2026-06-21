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
    <nav className="chips mb-6">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`chip${active ? " active" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
