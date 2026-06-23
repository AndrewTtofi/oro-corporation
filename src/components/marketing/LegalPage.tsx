import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";

export type LegalSection = { h: string; p: string[] };

export function LegalPage({
  title,
  updated,
  intro,
  sections,
  legalName,
  contactEmail,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  legalName: string;
  contactEmail: string | null;
}) {
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        <section className="section">
          <div className="mx-auto max-w-[760px]">
            <div className="eyebrow">LEGAL</div>
            <h1 style={{ fontSize: "clamp(1.9rem,3vw,2.441rem)", fontWeight: 700, letterSpacing: "-0.025em", margin: "12px 0" }}>{title}</h1>
            <p className="text-muted" style={{ fontSize: "0.8125rem" }}>Last updated {updated}</p>

            <div className="note mt-6">
              <span>This is a template provided for the platform and is not legal advice. Review and adapt with qualified counsel before relying on it.</span>
            </div>

            <p className="mt-8" style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--fg)" }}>{intro}</p>

            <div className="mt-8 flex flex-col gap-8">
              {sections.map((s, i) => (
                <section key={s.h}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 8 }}>
                    {i + 1}. {s.h}
                  </h2>
                  {s.p.map((para, j) => (
                    <p key={j} className="text-muted" style={{ fontSize: "0.9375rem", lineHeight: 1.7, marginBottom: 8 }}>{para}</p>
                  ))}
                </section>
              ))}
            </div>

            <hr className="hr mt-10" />
            <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
              Questions about this document? Contact {legalName}{contactEmail ? ` at ${contactEmail}` : ""}.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
