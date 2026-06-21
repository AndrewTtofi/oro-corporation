/** Shared line-icon set, ported from the platform prototype's ICON_PATHS.
 *  Usage: <Icon name="shield" className="ic-18" />. Styled via the `.ic` class. */
export const ICON_PATHS: Record<string, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v5h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  documents: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6",
  calendar: "M7 3v3 M17 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  message: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5.2A8 8 0 1 1 21 12z",
  check: "M5 13l4 4L19 7",
  x: "M6 6l12 12 M18 6L6 18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 20a7 7 0 0 1 14 0",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16 M15 21V9h4a1 1 0 0 1 1 1v11 M4 21h17 M8 8h3 M8 12h3 M8 16h3",
  shield: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z M9 12l2 2 4-4",
  upload: "M12 16V4 M7 9l5-5 5 5 M5 20h14",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-3.5-3.5",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8 M13.7 21a2 2 0 0 1-3.4 0",
  logout: "M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3 M16 17l5-5-5-5 M21 12H9",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3.5 9h17 M3.5 15h17 M12 3c2.5 2.5 3.5 5.7 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.7-3.5-9s1-6.5 3.5-9z",
  chevron: "M6 9l6 6 6-6",
  lock: "M6 10V8a6 6 0 1 1 12 0v2 M5 10h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
  sparkles: "M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z M19 14l.8 2 .2.8.8.2 2 .8-2 .8-.8.2-.2.8L19 22l-.8-2-.2-.8-.8-.2-2-.8 2-.8.8-.2.2-.8z",
  users: "M16 19a4 4 0 0 0-8 0 M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M20 19a3.5 3.5 0 0 0-4-3.4 M19 11.5a2.5 2.5 0 1 0-2-4",
  scale: "M12 3v18 M7 7h10 M7 7l-3 6a3 3 0 0 0 6 0z M17 7l3 6a3 3 0 0 1-6 0z M6 21h12",
  filter: "M3 5h18 M6 12h12 M10 19h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.2A1.6 1.6 0 0 0 4.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8z",
  plus: "M12 5v14 M5 12h14",
  briefcase: "M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  bank: "M3 10h18 M5 10v8 M9 10v8 M15 10v8 M19 10v8 M3 18h18 M12 3l9 5H3z",
  passport: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M9 15h6",
  flag: "M5 21V4 M5 4h10l-1.5 3L15 10H5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  sitemap: "M9 3h6v4H9z M4 17h6v4H4z M14 17h6v4h-6z M12 7v4 M7 17v-2h10v2 M12 11v4",
  plug: "M9 3v6 M15 3v6 M7 9h10v3a5 5 0 0 1-10 0z M12 17v4",
  zap: "M13 3L4 14h7l-1 7 9-11h-7z",
  pen: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  card: "M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M2 11h20 M6 15h4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2 16 16 0 0 1-15-15 2 2 0 0 1 1-2z",
  refresh: "M21 12a9 9 0 1 1-3-6.7 M21 4v4h-4",
  copy: "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
};

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  const d = ICON_PATHS[name] ?? "";
  const parts = d.split(" M").map((seg, i) => (i ? "M" + seg : seg));
  return (
    <svg className={`ic ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">
      {parts.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
