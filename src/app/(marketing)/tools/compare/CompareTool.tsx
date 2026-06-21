"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { JURISDICTIONS, RATES_REVIEWED } from "@/lib/data/jurisdictions";

type SortKey = "corpTax" | "vat" | "days" | "treaties";

export function CompareTool() {
  const [selected, setSelected] = useState<string[]>(["cy", "mt", "ee"]);
  const [sort, setSort] = useState<SortKey>("corpTax");

  const chosen = useMemo(() => {
    const list = JURISDICTIONS.filter((j) => selected.includes(j.id));
    return list.slice().sort((a, b) => (a[sort] as number) - (b[sort] as number));
  }, [selected, sort]);

  const best = useMemo(() => {
    if (!chosen.length) return null;
    return {
      corpTax: Math.min(...chosen.map((j) => j.corpTax)),
      days: Math.min(...chosen.map((j) => j.days)),
      treaties: Math.max(...chosen.map((j) => j.treaties)),
    };
  }, [chosen]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="t-num" style={{ cursor: "pointer" }} onClick={() => setSort(k)}>
      {label}{sort === k ? " ↓" : ""}
    </th>
  );

  return (
    <>
      <div className="jchips">
        {JURISDICTIONS.map((j) => {
          const on = selected.includes(j.id);
          return (
            <button key={j.id} className={`jchip${on ? " on" : ""}`} onClick={() => toggle(j.id)}>
              {j.flag} {j.name}{on ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      {chosen.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <Th k="corpTax" label="Corp tax" />
                <Th k="vat" label="VAT" />
                <Th k="days" label="Formation" />
                <th className="t-num">Min capital</th>
                <Th k="treaties" label="Tax treaties" />
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {chosen.map((j) => {
                const hl = (k: "corpTax" | "days" | "treaties") => best && (j[k] as number) === best[k];
                const cell = (k: "corpTax" | "days" | "treaties", v: string) => (
                  <td className="t-num" style={hl(k) ? { color: "var(--success)", fontWeight: 600 } : undefined}>{v}</td>
                );
                return (
                  <tr key={j.id} style={{ cursor: "default" }}>
                    <td>
                      <span style={{ fontSize: 18 }}>{j.flag}</span>{" "}
                      <strong title={j.note}>{j.name}</strong>
                      {j.note && <span className="muted" title={j.note} style={{ cursor: "help", marginLeft: 4 }}>ⓘ</span>}
                      {j.eu && <span className="tag" style={{ marginLeft: 6 }}>EU</span>}
                    </td>
                    {cell("corpTax", `${j.corpTax}%`)}
                    <td className="t-num">{j.vat}%</td>
                    {cell("days", `${j.days}d`)}
                    <td className="t-num">{j.minCap}</td>
                    {cell("treaties", String(j.treaties))}
                    <td>
                      <a href={j.sourceUrl} target="_blank" rel="noreferrer noopener" className="link-gold" style={{ fontSize: "var(--fs-xs)", whiteSpace: "nowrap" }} title="PwC Worldwide Tax Summaries">
                        PwC ↗
                      </a>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link href="/login" className="btn btn-ghost btn-sm">Apply →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <div className="ec">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M7 7h10M7 7l-3 6a3 3 0 0 0 6 0z M17 7l3 6a3 3 0 0 1-6 0z M6 21h12" /></svg>
          </div>
          <h3>Pick a jurisdiction</h3>
          <p>Select at least one chip above to build your comparison.</p>
        </div>
      )}
    </>
  );
}
