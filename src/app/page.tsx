import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { ServiceIcons, SERVICES } from "@/components/marketing/ServiceIcons";
import { getSiteContent } from "@/lib/services/content";

export default async function LandingPage() {
  const { hero, steps, servicesIntro, stats, testimonialsIntro, testimonials, cta } = await getSiteContent();
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className="hero">
          <div className="mx-auto max-w-[1200px]">
            <span className="hero-seal" />
            <div className="eyebrow"><span className="seal">—</span> {hero.eyebrow}</div>
            <h1>{hero.headline}</h1>
            <p className="lead">{hero.lead}</p>
            <div className="hero-cta">
              <Link href="/login" className="btn btn-primary btn-lg">{hero.primaryCta}</Link>
              <Link href="/services" className="btn btn-secondary btn-lg">{hero.secondaryCta}</Link>
            </div>
          </div>
        </header>

        {/* ── 3-step ───────────────────────────────────────────── */}
        <section id="how" className="section-sm">
          <div className="mx-auto max-w-[1200px] grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className="step-card">
                <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Services ─────────────────────────────────────────── */}
        <section id="services" className="section">
          <div className="mx-auto max-w-[1200px]">
            <div className="sec-head">
              <div className="eyebrow">{servicesIntro.eyebrow}</div>
              <h2>{servicesIntro.heading}</h2>
              <p>{servicesIntro.body}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((s) => (
                <Link key={s.key} href="/services" className="svc-card block">
                  <div className="svc-ic">{ServiceIcons[s.key]}</div>
                  <h3>{s.title}</h3>
                  <p>{s.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Proof bar ────────────────────────────────────────── */}
        <section className="section-sm">
          <div className="mx-auto max-w-[1200px]">
            <div className="proof-bar">
              {stats.map((s, i) => (
                <div key={i} className="proof-stat">
                  <div className="v">{s.v}</div>
                  <div className="l">{s.l}</div>
                </div>
              ))}
              <div style={{ marginLeft: "auto" }}>
                <div className="l" style={{ marginBottom: 6 }}>Trusted by founders from</div>
                <div className="flags">🇬🇧 🇩🇪 🇫🇷 🇳🇱 🇺🇸 🇦🇪 🇮🇳 🇨🇭 🇸🇪 🇮🇹</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────── */}
        <section className="section">
          <div className="mx-auto max-w-[1200px]">
            <div className="sec-head">
              <div className="eyebrow">{testimonialsIntro.eyebrow}</div>
              <h2>{testimonialsIntro.heading}</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <div key={i} className="testi">
                  <div className="stars">★★★★★</div>
                  <p>“{t.q}”</p>
                  <div className="who">
                    <div className="avatar">{t.n.split(" ").map((w) => w[0]).join("")}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t.n}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>{t.r}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA band ─────────────────────────────────────────── */}
        <section className="section">
          <div className="mx-auto max-w-[1200px]">
            <div className="cta-band">
              <h2>{cta.heading}</h2>
              <p>{cta.body}</p>
              <Link href="/login" className="btn btn-secondary btn-lg" style={{ marginTop: 32, background: "#fff", color: "var(--brand-dark)", borderColor: "#fff" }}>
                {cta.button}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
