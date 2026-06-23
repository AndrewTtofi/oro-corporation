"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ADVISOR_INTENTS, STARTER_CHIPS, intentById, matchIntent, advisorGreeting, type Intent } from "@/lib/data/advisor";
import { svcDef } from "@/lib/data/services";
import { JURISDICTIONS } from "@/lib/data/jurisdictions";

const jurOf = (id: string) => JURISDICTIONS.find((j) => j.id === id) ?? JURISDICTIONS[0];
type Rec = { serviceIds: string[]; jurIds: string[]; primaryJur: string; showProviders: boolean };
type Msg = { role: "me" | "them"; text?: string; card?: Rec };
type Stage = "await" | "typing" | "clarify" | "done";

export function AdvisorChat({ brand }: { brand: string }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "them", text: advisorGreeting(brand) }]);
  const [chips, setChips] = useState<string[] | null>(STARTER_CHIPS.slice());
  const [stage, setStage] = useState<Stage>("await");
  const pending = useRef<{ intentId: string } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => { const t = threadRef.current; if (t) t.scrollTop = t.scrollHeight; }, [messages, stage, chips]);

  function buildRec(intent: Intent) {
    const rec: Rec = { serviceIds: intent.recommendServices, jurIds: intent.recommendJurisdictions, primaryJur: intent.recommendJurisdictions[0], showProviders: intent.showProviders };
    setChips(null);
    setMessages((m) => [...m, { role: "them", card: rec }]);
    setStage("done");
  }

  function respond(text: string) {
    if (pending.current) {
      const intent = intentById(pending.current.intentId);
      let target = intent;
      if (intent.branchRoute && intent.branchRoute[text]) target = intentById(intent.branchRoute[text]);
      const reply = (intent.botReplyAfter && intent.botReplyAfter[text]) || target.botReply;
      pending.current = null;
      setMessages((m) => [...m, { role: "them", text: reply }]);
      buildRec(target);
      return;
    }
    const intent = matchIntent(text);
    setMessages((m) => [...m, { role: "them", text: intent.botReply }]);
    if (intent.clarify) { pending.current = { intentId: intent.id }; setChips(intent.clarifyChips ?? []); setStage("clarify"); return; }
    if (intent.id === "fallback") { pending.current = null; setChips(intent.clarifyChips ?? []); setStage("await"); return; }
    buildRec(intent);
  }

  function receive(text: string) {
    if (!text || !text.trim()) return;
    setChips(null);
    setMessages((m) => [...m, { role: "me", text: text.trim() }]);
    setStage("typing");
    setTimeout(() => respond(text.trim()), 750);
  }

  function reset() {
    pending.current = null;
    setMessages([{ role: "them", text: advisorGreeting(brand) }]);
    setChips(STARTER_CHIPS.slice());
    setStage("await");
  }

  const RecCard = ({ card }: { card: Rec }) => {
    const jr = jurOf(card.primaryJur);
    const others = card.jurIds.slice(1).map((id) => `${jurOf(id).flag} ${jurOf(id).name}`).join(" · ");
    const ps = card.serviceIds[0];
    return (
      <div className="card advisor-rec">
        <div className="eyebrow mb-3"><span className="seal">—</span> MY RECOMMENDATION</div>
        <div className="flabel">{card.serviceIds.length > 1 ? "Services" : "Service"}</div>
        {card.serviceIds.map((id, i) => {
          const sx = svcDef(id);
          return (
            <div key={id} className="rec-svc">
              <div className="svc-ic" style={{ width: 32, height: 32, margin: 0 }}><Icon name={sx.icon} /></div>
              <div className="grow">
                <div className="row gap-2" style={{ alignItems: "center" }}><strong>{sx.name}</strong>{i === 0 && <span className="badge badge-new">Recommended</span>}</div>
                <div className="muted" style={{ fontSize: "var(--fs-xs)" }}>From {sx.priceFrom} · {sx.billing === "monthly" ? "monthly" : "one-off"} · ~{sx.timeline}</div>
              </div>
            </div>
          );
        })}
        <div className="flabel mt-4">Where</div>
        <div className="rec-jur">
          <div className="row-between wrap">
            <div className="row gap-2" style={{ alignItems: "center" }}><span style={{ fontSize: 20 }}>{jr.flag}</span><strong>{jr.name}</strong>{jr.eu && <span className="tag">EU</span>}</div>
            <div className="row gap-3 mono muted" style={{ fontSize: "var(--fs-xs)" }}><span>Corp {jr.corpTax}%</span><span>VAT {jr.vat}%</span><span>~{jr.days}d</span></div>
          </div>
          {others && <div className="muted mt-2" style={{ fontSize: "var(--fs-xs)" }}>Also strong: {others}</div>}
        </div>
        <div className="note mt-4"><Icon name="sparkles" className="ic-16" /><div>Indicative — from {svcDef(ps).priceFrom} · live in ~{jr.days} days · {jr.corpTax}% on profits. Your specialist confirms before anything is filed.</div></div>
        <div className="row gap-2 mt-4 wrap">
          <Link href="/login" className="btn btn-primary"><Icon name="arrow" className="ic-16" /> Start application</Link>
          {card.showProviders && <Link href="/marketplace" className="btn btn-secondary"><Icon name="users" className="ic-16" /> See matching providers</Link>}
          <Link href="/tools/compare" className="btn btn-ghost"><Icon name="scale" className="ic-16" /> Compare jurisdictions</Link>
        </div>
        <div className="muted mt-3" style={{ fontSize: "var(--fs-2xs)" }}>Starting points, not formal advice — your dedicated specialist confirms before anything is filed.</div>
      </div>
    );
  };

  const send = () => { const v = input; setInput(""); receive(v); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const showChips = !!chips && chips.length > 0 && stage !== "typing";

  // Landing state — a focused, Lovable-style prompt hero. Switches to the
  // conversation view the moment the visitor sends their first message.
  const started = messages.some((m) => m.role === "me") || stage !== "await";

  if (!started) {
    return (
      <div className="advisor-wrap is-hero">
        <div className="advisor-hero">
          <h1 className="advisor-hero-title">What are you trying to do?</h1>
          <p className="advisor-hero-sub">
            Lower tax, set up a company, open banking, relocate — tell {brand}{" "}
            your situation and get an instant service &amp; jurisdiction recommendation.
          </p>

          <div className="hero-composer">
            <textarea
              className="hc-input" value={input} rows={2} autoFocus autoComplete="off"
              placeholder="Describe what you need in plain words…"
              onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
            />
            <div className="hc-foot">
              <span className="hc-hint"><Icon name="sparkles" className="ic-16" /> Free · instant · no sign-up</span>
              <button className="hc-send" aria-label="Send" disabled={!input.trim()} onClick={send}><Icon name="arrow" /></button>
            </div>
          </div>

          {showChips && (
            <div className="chips advisor-hero-chips">
              {chips!.map((c) => <button key={c} className="chip" onClick={() => receive(c)}>{c}</button>)}
            </div>
          )}
          <p className="advisor-hero-foot">Starting points, not formal advice — a specialist confirms before anything is filed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="advisor-wrap is-chat">
      <div className="advisor-head">
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <div className="avatar" style={{ background: "var(--brand)" }}><Icon name="sparkles" className="ic-18" /></div>
          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{brand} Advisor <span className="badge badge-new">AI</span></div><div className="muted advisor-sub" style={{ fontSize: "var(--fs-2xs)" }}>Free, instant, no sign-up · tell me your situation</div></div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={reset}>Start over</button>
      </div>

      <div className="thread advisor-thread" ref={threadRef}>
        {messages.map((m, i) => m.card
          ? <div key={i} className="bubble them" style={{ maxWidth: "96%", background: "transparent", padding: 0 }}><RecCard card={m.card} /></div>
          : <div key={i} className={`bubble ${m.role === "me" ? "me" : "them"}`}>{m.text}</div>)}
        {stage === "typing" && <div className="bubble them typing"><span /><span /><span /></div>}
        {showChips && (
          <div className="chips advisor-chips">{chips!.map((c) => <button key={c} className="chip" onClick={() => receive(c)}>{c}</button>)}</div>
        )}
      </div>

      <div className="composer advisor-composer">
        <textarea className="input hc-input" value={input} placeholder="Describe what you need…" rows={1} autoComplete="off"
          onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} />
        <button className="btn btn-primary btn-icon" aria-label="Send" disabled={!input.trim()} onClick={send}><Icon name="arrow" /></button>
      </div>
    </div>
  );
}
