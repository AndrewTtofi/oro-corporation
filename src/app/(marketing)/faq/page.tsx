import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { getSiteContent } from "@/lib/services/content";

export const metadata = { title: "FAQ" };

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export default async function FaqPage() {
  const { faq } = await getSiteContent();
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        <section className="section">
          <div className="mx-auto max-w-[760px]">
            <div className="sec-head">
              <div className="eyebrow">QUESTIONS</div>
              <h2>Frequently asked.</h2>
            </div>

            <div className="acc">
              {faq.map((item, i) => (
                <details key={i} className="acc-item">
                  <summary className="acc-q">{item.q}<Chevron /></summary>
                  <div className="acc-a">{item.a}</div>
                </details>
              ))}
            </div>

            <div className="card mt-8 text-center" style={{ background: "var(--brand-50)", borderColor: "transparent" }}>
              <h3 style={{ fontWeight: 600, fontSize: "1.25rem" }}>Still have questions?</h3>
              <p className="text-muted mt-2">Start an application — you can save and exit at any point.</p>
              <Link href="/login" className="btn btn-primary mt-4">Start your application</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
