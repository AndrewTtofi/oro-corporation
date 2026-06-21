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
    <div className="card mb-6">
      <div className="row gap-6" style={{ alignItems: "center" }}>
        <div className="avatar" style={{ width: 80, height: 80, fontSize: "1.5rem" }}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="eyebrow mb-2">Engagement</div>
          <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{name}</h2>
          <dl className="dl mt-3" style={{ gridTemplateColumns: "repeat(3, auto 1fr)" }}>
            <dt>Company</dt><dd>{company}</dd>
            <dt>Reference</dt><dd className="mono">{reference}</dd>
            <dt>Client since</dt><dd>{since.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</dd>
            <dt>Country</dt><dd>{country}</dd>
            <dt>Telephone</dt><dd className="mono">{phone}</dd>
            <dt>Email</dt><dd>{email}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
