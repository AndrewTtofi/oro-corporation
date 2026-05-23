import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { ServiceIcons, SERVICES } from "@/components/marketing/ServiceIcons";

export default function LandingPage() {
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        {/* Hero */}
        <section className="py-24 lg:py-32">
          <div className="container flex flex-col items-center text-center">
            <p className="eyebrow mb-6">A Premier Fiduciary Firm</p>
            <h1 className="text-h1 font-display mb-6">
              Your Gateway to <br /> Business in Cyprus
            </h1>
            <p className="text-lead text-muted max-w-[50ch] mb-10">
              Seamless company formation, tax residency, and corporate solutions for international
              entrepreneurs and high-net-worth individuals.
            </p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/login" className="btn btn-primary px-7 py-3.5">Start Application</Link>
              <Link href="#services" className="btn btn-outline px-7 py-3.5">Explore Services</Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20 lg:py-24">
          <div className="container">
            <div className="flex items-end justify-between mb-16 flex-wrap gap-6">
              <div className="max-w-[40ch]">
                <p className="eyebrow mb-6">The Process</p>
                <h2 className="text-h2 font-display">How It Works</h2>
              </div>
              <p className="text-lead text-muted max-w-[50ch]">
                We&apos;ve streamlined the onboarding process to get you to your expert consultation faster.
              </p>
            </div>
            <div className="grid gap-10 md:grid-cols-3">
              {[
                { n: "01", title: "Tell Us About Your Needs", body: "Complete our digital application and select the services that match your business goals." },
                { n: "02", title: "We Review Your Profile", body: "Our compliance team reviews your documents to ensure a seamless setup experience." },
                { n: "03", title: "Book Expert Consultation", body: "Once approved, book a direct meeting with our professional advisors to finalize your strategy." },
              ].map((s) => (
                <div key={s.n} className="surface rounded-card p-8 transition-transform hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="w-10 h-10 grid place-items-center rounded-full border border-accent text-accent font-mono mb-6">
                    {s.n}
                  </div>
                  <h3 className="text-h3 mb-4">{s.title}</h3>
                  <p className="text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="py-20 lg:py-24 surface border-y" style={{ borderColor: "var(--border)" }}>
          <div className="container">
            <p className="eyebrow text-center mb-6">Our Expertise</p>
            <h2 className="text-h2 font-display text-center mb-16">Comprehensive Solutions</h2>
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((s) => (
                <div key={s.key} className="flex flex-col gap-4">
                  <div className="w-12 h-12 grid place-items-center rounded-elem bg-dark text-accent">
                    <span className="w-6 h-6 block">{ServiceIcons[s.key]}</span>
                  </div>
                  <h3 className="text-h3">{s.title}</h3>
                  <p className="text-muted">{s.blurb}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats band — dark */}
        <section className="bg-dark py-20 lg:py-24">
          <div className="container grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
            {[
              { n: "150", suffix: "+", label: "Companies Incorporated" },
              { n: "100", suffix: "%", label: "Compliance Rate" },
              { n: "25", suffix: "+", label: "Banking Relationships" },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display font-mono text-accent" style={{ fontSize: 64, lineHeight: 1 }}>
                  {s.n}<span style={{ fontSize: 32, verticalAlign: "middle" }}>{s.suffix}</span>
                </div>
                <p className="text-meta mt-3" style={{ color: "color-mix(in oklch, var(--client-bg) 60%, transparent)" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 text-center">
          <div className="container flex flex-col items-center">
            <h2 className="text-h2 font-display mb-6">Ready to expand to Cyprus?</h2>
            <p className="text-lead text-muted mb-10">
              Start your application today and qualify for a free consultation with our experts.
            </p>
            <Link href="/login" className="btn btn-primary px-8 py-4">Begin Onboarding</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
