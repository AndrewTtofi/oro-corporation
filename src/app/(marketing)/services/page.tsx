import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { ServiceIcons, SERVICES } from "@/components/marketing/ServiceIcons";

export const metadata = { title: "Services" };

export default function ServicesMarketingPage() {
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        <section className="py-20 lg:py-24">
          <div className="container max-w-[1000px]">
            <p className="eyebrow mb-6">Our Expertise</p>
            <h1 className="text-h2 font-display mb-6">Comprehensive Solutions for International Founders</h1>
            <p className="text-lead text-muted max-w-[60ch] mb-16">
              From your first Cyprus company to ongoing tax and compliance, ORO delivers the
              full stack of fiduciary services under one roof.
            </p>
            <div className="grid gap-8 md:grid-cols-2">
              {SERVICES.map((s) => (
                <article key={s.key} className="surface rounded-card p-8 flex gap-6">
                  <div className="w-12 h-12 shrink-0 grid place-items-center rounded-elem bg-dark text-accent">
                    <span className="w-6 h-6 block">{ServiceIcons[s.key]}</span>
                  </div>
                  <div>
                    <h2 className="text-h3 mb-2">{s.title}</h2>
                    <p className="text-muted">{s.longBlurb}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-20 text-center">
              <Link href="/login" className="btn btn-primary px-8 py-4">Begin your application</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
