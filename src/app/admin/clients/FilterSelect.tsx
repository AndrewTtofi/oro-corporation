"use client";

export function FilterSelect({
  name, label, current, options,
}: { name: string; label: string; current: string; options: { value: string; label: string }[] }) {
  return (
    <form method="GET" className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase text-admin-muted tracking-widest">{label}</span>
      <select
        name={name}
        defaultValue={current}
        className="px-3 py-1.5 rounded-inner text-[13px] min-w-[140px] bg-admin-surface"
        style={{ border: "1px solid var(--border)" }}
        onChange={(e) => e.currentTarget.form?.submit()}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </form>
  );
}
