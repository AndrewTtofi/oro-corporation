export function ClientHeader({
  initials, name, company, reference, since, country, phone, email,
}: {
  initials: string;
  name: string;
  company: string;
  reference: string;
  since: Date;
  country: string;
  phone: string;
  email: string;
}) {
  return (
    <div className="bg-admin-surface border border-admin-border rounded-card mb-6 overflow-hidden">
      <div className="p-6 flex gap-6 items-center">
        <div className="w-20 h-20 rounded-card grid place-items-center font-display font-bold text-3xl"
             style={{ background: "var(--dark)", color: "var(--accent)" }}>
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-3xl">{name}</h1>
          <div className="flex gap-4 text-meta text-admin-muted mt-1 flex-wrap">
            <div><b className="text-admin-fg">{company}</b></div>
            <div>Ref: <span className="font-mono">{reference}</span></div>
            <div>Client Since: {since.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <div className="flex gap-4 text-meta text-admin-muted mt-2 flex-wrap">
            <div>📍 {country}</div>
            <div>📞 {phone}</div>
            <div>✉️ {email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
