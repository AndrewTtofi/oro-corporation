"use client";

import { useMemo, useState } from "react";
import { PROVIDERS, PROVIDER_CATEGORIES, catLabel, type Provider, type ProviderCategory } from "@/lib/data/marketplace";
import { JURISDICTIONS } from "@/lib/data/jurisdictions";

const FLAG: Record<string, string> = Object.fromEntries(JURISDICTIONS.map((j) => [j.id, j.flag]));
const NAME: Record<string, string> = Object.fromEntries(JURISDICTIONS.map((j) => [j.id, j.name]));
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const feeEl = (v: string) => (v === "Free" ? <span style={{ color: "var(--success)", fontWeight: 600 }}>Free</span> : <span className="mono">{v}</span>);
const speedMatch = (d: string, s: string) => {
  if (s === "instant") return /business day/.test(d) && parseInt(d) <= 3;
  if (s === "week") return !/month/.test(d) && (/week/.test(d) || /business day/.test(d));
  if (s === "month") return /month/.test(d);
  return true;
};

export function MarketplaceTool({ brand, authed }: { brand: string; authed: boolean }) {
  const [cat, setCat] = useState<ProviderCategory>("all");
  const [jurF, setJurF] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [speed, setSpeed] = useState("all");
  const [remote, setRemote] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("featured");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(6);
  const [compare, setCompare] = useState<string[]>([]);
  const [detail, setDetail] = useState<Provider | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [applied, setApplied] = useState<Provider | null>(null);
  const [concierge, setConcierge] = useState(false);

  const all = useMemo(() => {
    let list = PROVIDERS.slice();
    if (cat !== "all") list = list.filter((p) => p.category === cat);
    if (jurF !== "all") list = list.filter((p) => p.jurisdictions.includes(jurF));
    if (industry !== "all") list = list.filter((p) => p.industries.includes(industry));
    if (remote) list = list.filter((p) => p.remote);
    if (speed !== "all") list = list.filter((p) => speedMatch(p.onboardDays, speed));
    if (q) { const s = q.toLowerCase(); list = list.filter((p) => (p.name + " " + p.type + " " + p.blurb).toLowerCase().includes(s)); }
    const sp = (p: Provider) => parseInt(String(p.onboardDays)) || 99;
    const fee = (p: Provider) => (p.monthlyFee === "—" ? 9999 : parseInt(String(p.monthlyFee).replace(/[^0-9]/g, "")) || 0);
    if (sort === "featured") list.sort((a, b) => Number(b.sponsored) - Number(a.sponsored) || b.rating - a.rating);
    else if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    else if (sort === "fastest") list.sort((a, b) => sp(a) - sp(b));
    else if (sort === "fees") list.sort((a, b) => fee(a) - fee(b));
    return list;
  }, [cat, jurF, industry, speed, remote, q, sort]);

  const shown = all.slice(0, page);
  const verifiedCount = PROVIDERS.filter((p) => p.verified).length;
  const featured = cat === "all" && !q ? PROVIDERS.filter((p) => p.sponsored) : [];
  const dirty = cat !== "all" || jurF !== "all" || industry !== "all" || speed !== "all" || remote || !!q;

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  }
  function clearFilters() { setCat("all"); setJurF("all"); setIndustry("all"); setSpeed("all"); setRemote(false); setQ(""); setSort("featured"); setPage(6); }
  async function apply(p: Provider) {
    setDetail(null); setShowCompare(false);
    setCompare((c) => c.filter((x) => x !== p.id));
    setApplied(p);
    try { await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: p.id, providerName: p.name, category: p.category }) }); } catch { /* visitor / non-fatal */ }
  }

  const Card = ({ p }: { p: Provider }) => {
    const inC = compare.includes(p.id);
    const facts = p.category === "banking"
      ? [["Opening", feeEl(p.openingFee)], ["Monthly", <span key="m" className="mono">{p.monthlyFee}</span>], ["Min deposit", <span key="d" className="mono">{p.minDeposit}</span>]]
      : [["Setup", feeEl(p.openingFee)], ["Ongoing", <span key="o" className="mono">{p.monthlyFee}</span>], ["Lead time", <span key="l" className="mono">{p.onboardDays}</span>]];
    return (
      <div className="card mkt-card">
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div className="row gap-3" style={{ alignItems: "center" }}>
            <div className="avatar avatar-sq">{initials(p.name)}</div>
            <div><div style={{ fontWeight: 600 }}>{p.name}</div><div className="muted" style={{ fontSize: "var(--fs-xs)" }}>{p.type}</div></div>
          </div>
          <div className="stack gap-2" style={{ alignItems: "flex-end" }}>
            {p.sponsored && <span className="tag" style={{ color: "var(--accent)" }}>Featured</span>}
            {p.verified && <span className="badge badge-approved" title={`Vetted by ${brand}`}><span className="bdot" />Verified</span>}
          </div>
        </div>
        <p className="muted mt-3" style={{ fontSize: "var(--fs-sm)" }}>{p.blurb}</p>
        <div className="row gap-3 mt-3" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>{p.jurisdictions.slice(0, 3).map((j) => FLAG[j] ?? "").join(" ")}{p.jurisdictions.length > 3 && <span className="muted mono" style={{ fontSize: "var(--fs-2xs)" }}> +{p.jurisdictions.length - 3}</span>}</span>
          <span className="muted">·</span>
          <span className="muted mono" style={{ fontSize: "var(--fs-xs)" }}>{p.onboardDays}</span>
          <span className="right"><span className="stars">★</span> <span className="mono" style={{ fontSize: "var(--fs-xs)" }}>{p.rating.toFixed(1)}</span></span>
        </div>
        <dl className="dl mt-3" style={{ fontSize: "var(--fs-xs)" }}>{facts.map(([k, v], i) => (<div key={i} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
        <div className="row gap-2 mt-3 wrap">
          {p.industries.map((i) => <span key={i} className="tag" style={/crypto|forex|iGaming/.test(i) ? { color: "var(--accent)" } : undefined}>{i}</span>)}
          {p.remote && <span className="tag">Remote</span>}
        </div>
        <div className="row gap-2 mt-4" style={{ marginTop: "auto", paddingTop: "var(--space-3)" }}>
          <button className="btn btn-primary btn-sm grow" onClick={() => apply(p)}>Get started</button>
          <button className={`chip${inC ? " active" : ""}`} onClick={() => toggleCompare(p.id)}>{inC ? "Added" : "Compare"}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDetail(p)}>Details</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="eyebrow mb-2">CURATED BY {brand.toUpperCase()}</div>
      <div className="row-between wrap mb-4" style={{ alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-.02em" }}>Our vetted partner network.</h2>
          <p className="muted mt-2" style={{ maxWidth: "62ch" }}>Every bank, EMI and provider here has been reviewed and onboarded by {brand}. Compare, shortlist and apply — we make the introduction and stay on the file.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setConcierge(true)}>Talk to a concierge</button>
      </div>
      <div className="row gap-3 mb-5 wrap" style={{ fontSize: "var(--fs-xs)" }}>
        <span className="badge badge-approved"><span className="bdot" />{verifiedCount} verified partners</span>
        <span className="muted">Reviewed &amp; onboarded by {brand} · we earn nothing from listing</span>
      </div>

      <div className="toggle-group mkt-cats mb-4">
        {PROVIDER_CATEGORIES.map((c) => (
          <button key={c.id} className={cat === c.id ? "active" : ""} onClick={() => { setCat(c.id); setPage(6); }}>{c.label}</button>
        ))}
      </div>

      <div className="card mb-5">
        <div className="row gap-3 wrap mkt-filterbar">
          <div className="searchbox grow" style={{ maxWidth: 260 }}>
            <input placeholder="Search partners…" value={q} onChange={(e) => { setQ(e.target.value); setPage(6); }} />
          </div>
          <select className="select" style={{ width: "auto" }} value={jurF} onChange={(e) => { setJurF(e.target.value); setPage(6); }}>
            <option value="all">All jurisdictions</option>
            {JURISDICTIONS.map((j) => <option key={j.id} value={j.id}>{j.flag} {j.name}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(6); }}>
            {["all", "general", "crypto", "forex", "iGaming", "fintech", "ecommerce", "trade"].map((o) => <option key={o} value={o}>{o === "all" ? "All industries" : o}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={speed} onChange={(e) => { setSpeed(e.target.value); setPage(6); }}>
            {[["all", "Any speed"], ["instant", "≤3 days"], ["week", "Within weeks"], ["month", "Licensing (months)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className={`chip${remote ? " active" : ""}`} onClick={() => { setRemote((r) => !r); setPage(6); }}>Remote</button>
          <div className="right row gap-2">
            <select className="select" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
              {[["featured", "Featured"], ["rating", "Top rated"], ["fastest", "Fastest onboarding"], ["fees", "Lowest fees"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="toggle-group">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
            </div>
          </div>
        </div>
        <div className="row-between mt-3 wrap" style={{ fontSize: "var(--fs-xs)" }}>
          <span className="muted">Showing <span className="mono">{shown.length}</span> of <span className="mono">{all.length}</span> partners</span>
          {dirty && <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>

      {featured.length > 0 && (
        <>
          <div className="eyebrow mb-3">FEATURED PARTNERS</div>
          <div className="grid grid-3 mb-8">{featured.map((p) => <Card key={p.id} p={p} />)}</div>
        </>
      )}

      {all.length === 0 ? (
        <div className="empty"><h3>No partners match</h3><p>Try widening your filters or talk to our concierge.</p><button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button></div>
      ) : view === "grid" ? (
        <div className="grid grid-3 mkt-grid">{shown.map((p) => <Card key={p.id} p={p} />)}</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Partner</th><th>Category</th><th>Jurisdictions</th><th>Onboard</th><th>Monthly</th><th>Rating</th><th></th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setDetail(p)}>
                  <td><div className="cell-entity"><div className="avatar avatar-sq" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(p.name)}</div><div><div style={{ fontWeight: 500 }}>{p.name}</div><div className="sub">{p.type}</div></div></div></td>
                  <td>{catLabel(p.category)}</td>
                  <td>{p.jurisdictions.slice(0, 4).map((j) => FLAG[j] ?? "").join(" ")}</td>
                  <td className="mono">{p.onboardDays}</td>
                  <td className="mono">{p.monthlyFee}</td>
                  <td className="mono">{p.rating.toFixed(1)}</td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); apply(p); }}>Get started</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {all.length > page && <div className="center mt-6"><button className="btn btn-secondary" onClick={() => setPage((p) => p + 6)}>Load more partners</button></div>}

      <div className="note mt-8" style={{ marginBottom: compare.length ? 96 : 24 }}>
        <div>{brand} curates this network and earns nothing from listing — partners are selected on merit and reviewed annually. All introductions are made and managed by {brand}, so your client relationship stays yours.</div>
      </div>

      {/* Compare bar */}
      {compare.length > 0 && (
        <div className="compare-bar">
          <div className="container row-between wrap">
            <div className="row gap-3 wrap" style={{ alignItems: "center" }}>
              <strong>{compare.length} selected</strong>
              {compare.map((id) => <span key={id} className="tag">{PROVIDERS.find((p) => p.id === id)?.name}</span>)}
            </div>
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setCompare([])}>Clear</button>
              <button className="btn btn-primary btn-sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare</button>
            </div>
          </div>
        </div>
      )}

      {/* Provider detail modal */}
      {detail && (
        <Scrim onClose={() => setDetail(null)}>
          <div className="modal">
            <div className="modal-head">
              <div className="row gap-3" style={{ alignItems: "center" }}><div className="avatar avatar-sq">{initials(detail.name)}</div><div><div style={{ fontWeight: 600 }}>{detail.name}</div><div className="muted" style={{ fontSize: "var(--fs-xs)" }}>{detail.type}{detail.verified && <> · <span style={{ color: "var(--success)" }}>Verified partner</span></>}</div></div></div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="muted mb-4">{detail.blurb}</p>
              <dl className="dl mb-5">
                {detail.category === "banking"
                  ? (<><dt>Account opening</dt><dd>{feeEl(detail.openingFee)}</dd><dt>Monthly fee</dt><dd className="mono">{detail.monthlyFee}</dd><dt>Min deposit</dt><dd className="mono">{detail.minDeposit}</dd></>)
                  : (<><dt>Setup</dt><dd>{feeEl(detail.openingFee)}</dd><dt>Ongoing</dt><dd className="mono">{detail.monthlyFee}</dd></>)}
                <dt>Onboarding</dt><dd className="mono">{detail.onboardDays}</dd>
                <dt>Currencies</dt><dd>{detail.currencies}</dd>
                <dt>Jurisdictions</dt><dd>{detail.jurisdictions.map((j) => `${FLAG[j] ?? ""} ${NAME[j] ?? j}`).join(", ")}</dd>
              </dl>
              <div className="flabel mb-3">What they handle</div>
              {detail.features.map((f) => <div key={f} className="row gap-2 mb-2" style={{ fontSize: "var(--fs-sm)" }}>✓ <span>{f}</span></div>)}
              <div className="note mt-4"><div>Vetted and onboarded by {brand}. We make the introduction and remain on file as your point of contact.</div></div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => { toggleCompare(detail.id); setDetail(null); }}>Add to compare</button>
              <button className="btn btn-primary" onClick={() => apply(detail)}>Get started →</button>
            </div>
          </div>
        </Scrim>
      )}

      {/* Compare modal */}
      {showCompare && compare.length >= 2 && (() => {
        const ps = compare.map((id) => PROVIDERS.find((p) => p.id === id)!).filter(Boolean);
        const Row = ({ label, fn }: { label: string; fn: (p: Provider) => React.ReactNode }) => (<tr><td className="muted">{label}</td>{ps.map((p) => <td key={p.id}>{fn(p)}</td>)}</tr>);
        return (
          <Scrim onClose={() => setShowCompare(false)}>
            <div className="modal" style={{ maxWidth: 920 }}>
              <div className="modal-head"><h3>Compare partners</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowCompare(false)}>✕</button></div>
              <div className="modal-body">
                <div className="tbl-wrap"><table className="tbl"><thead><tr><th></th>{ps.map((p) => <th key={p.id}>{p.name}<div className="muted" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{p.type}</div></th>)}</tr></thead><tbody>
                  <Row label="Category" fn={(p) => catLabel(p.category)} />
                  <Row label="Jurisdictions" fn={(p) => p.jurisdictions.map((j) => FLAG[j] ?? "").join(" ")} />
                  <Row label="Verified" fn={(p) => (p.verified ? <span className="badge badge-approved"><span className="bdot" />Yes</span> : "—")} />
                  <Row label="Opening fee" fn={(p) => feeEl(p.openingFee)} />
                  <Row label="Monthly" fn={(p) => <span className="mono">{p.monthlyFee}</span>} />
                  <Row label="Min deposit" fn={(p) => <span className="mono">{p.minDeposit}</span>} />
                  <Row label="Onboarding" fn={(p) => <span className="mono">{p.onboardDays}</span>} />
                  <Row label="Currencies" fn={(p) => p.currencies} />
                  <Row label="Rating" fn={(p) => <><span className="stars">★</span> <span className="mono">{p.rating.toFixed(1)}</span></>} />
                  <tr><td></td>{ps.map((p) => <td key={p.id}><button className="btn btn-primary btn-sm" onClick={() => apply(p)}>Get started</button></td>)}</tr>
                </tbody></table></div>
                <p className="muted mt-3" style={{ fontSize: "var(--fs-xs)" }}>All introductions are made and managed by {brand}.</p>
              </div>
            </div>
          </Scrim>
        );
      })()}

      {/* Apply success modal */}
      {applied && (
        <Scrim onClose={() => setApplied(null)}>
          <div className="modal">
            <div className="modal-head"><h3>Sent to {applied.name}</h3><button className="btn btn-ghost btn-icon" onClick={() => setApplied(null)}>✕</button></div>
            <div className="modal-body">
              <div className="center mb-4"><div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--success-tint)", color: "var(--success)", display: "grid", placeItems: "center", margin: "0 auto", fontSize: 28 }}>✓</div></div>
              <p className="center mb-4">Your request is in. {applied.name} typically responds <strong>within 24 hours</strong>.</p>
              <div className="note mb-4"><div>We reused your verified KYC profile — no documents to re-submit. One profile, every partner.</div></div>
              {!authed && <p className="muted center" style={{ fontSize: "var(--fs-xs)" }}>Sign in to track this in “My applications”.</p>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setApplied(null)}>Browse more</button>
              {authed && <a className="btn btn-primary" href="/app/applications">View my applications</a>}
            </div>
          </div>
        </Scrim>
      )}

      {/* Concierge modal */}
      {concierge && (
        <Scrim onClose={() => setConcierge(false)}>
          <div className="modal">
            <div className="modal-head"><h3>{brand} concierge</h3><button className="btn btn-ghost btn-icon" onClick={() => setConcierge(false)}>✕</button></div>
            <div className="modal-body">
              <p className="mb-3">Complex or multi-jurisdiction case? A {brand} specialist will hand-match you to the right partners and manage the introductions personally.</p>
              <div className="note"><div>Best for high-risk sectors, multiple entities, or when you are not sure where to start.</div></div>
            </div>
            <div className="modal-foot"><button className="btn btn-ghost" onClick={() => setConcierge(false)}>Cancel</button><button className="btn btn-primary" onClick={() => setConcierge(false)}>Request concierge review</button></div>
          </div>
        </Scrim>
      )}
    </>
  );
}

function Scrim({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>{children}</div>;
}
