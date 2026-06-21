"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { JURISDICTIONS, HOME_COUNTRY_RATES } from "@/lib/data/jurisdictions";

const fmt = (n: number) => "€" + Math.round(n).toLocaleString();

export function CalculatorTool() {
  const [from, setFrom] = useState("United Kingdom");
  const [target, setTarget] = useState("cy");
  const [profit, setProfit] = useState(250000);
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fromRate = HOME_COUNTRY_RATES[from] ?? 25;
  const tgt = JURISDICTIONS.find((j) => j.id === target) ?? JURISDICTIONS[0];
  const { cur, proj, save } = useMemo(() => {
    const cur = Math.round((profit * fromRate) / 100);
    const proj = Math.round((profit * tgt.corpTax) / 100);
    return { cur, proj, save: cur - proj };
  }, [profit, fromRate, tgt]);

  async function reveal() {
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Enter a valid email to reveal the breakdown.");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "calculator", note: `Tax calc: ${tgt.name} · profit ${fmt(profit)}` }),
      });
    } catch {
      /* non-blocking: still reveal even if the lead save fails */
    }
    setSaving(false);
    setUnlocked(true);
  }

  return (
    <div className="calc-grid">
      <div className="card card-pad-lg">
        <div className="field">
          <label>Current country</label>
          <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
            {Object.keys(HOME_COUNTRY_RATES).map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Target jurisdiction</label>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            {JURISDICTIONS.map((j) => <option key={j.id} value={j.id}>{j.flag} {j.name} ({j.corpTax}%)</option>)}
          </select>
        </div>
        <div className="field">
          <label>Annual profit — <span className="mono">{fmt(profit)}</span></label>
          <input type="range" min={50000} max={2000000} step={50000} value={profit} onChange={(e) => setProfit(parseInt(e.target.value))} style={{ width: "100%" }} />
        </div>
      </div>

      <div className={`gated${unlocked ? "" : " locked"}`}>
        <div className="calc-result blurme">
          <div className="lbl">Estimated annual saving</div>
          <div className="big mono">{fmt(save)}</div>
          <div className="calc-row"><span>Current tax ({fromRate}%)</span><span className="num">{fmt(cur)}</span></div>
          <div className="calc-row"><span>Projected tax ({tgt.corpTax}%)</span><span className="num">{fmt(proj)}</span></div>
          <div className="calc-row"><span>Five-year saving</span><span className="num">{fmt(save * 5)}</span></div>
          <Link href="/login" className="btn btn-secondary mt-6" style={{ background: "#fff", color: "var(--brand-dark)", borderColor: "#fff" }}>
            Apply to lock in these savings
          </Link>
        </div>

        {!unlocked && (
          <div className="gate-over">
            <div className="gate-card">
              <svg className="ic ic-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <h3 style={{ fontWeight: 600, margin: "10px 0 4px" }}>See your full breakdown</h3>
              <p className="muted" style={{ fontSize: "var(--fs-sm)", marginBottom: 12 }}>Enter your email and we will reveal the numbers (and save your result).</p>
              <input className="input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              {error && <p className="help" style={{ color: "var(--danger)", marginBottom: 8 }}>{error}</p>}
              <button className="btn btn-primary btn-block" disabled={saving} onClick={reveal}>{saving ? "Saving…" : "Reveal my breakdown"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
