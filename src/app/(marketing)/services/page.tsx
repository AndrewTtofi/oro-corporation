import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { ServiceIcons, SERVICES } from "@/components/marketing/ServiceIcons";
import { getBranding } from "@/lib/services/branding";

export const metadata = { title: "Services" };

export default async function ServicesMarketingPage() {
  const { brandName } = await getBranding();
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        <section className="section">
          <div className="mx-auto max-w-[1200px]">
            <div className="sec-head">
              <div className="eyebrow">OUR EXPERTISE</div>
              <h2>Comprehensive solutions for international founders.</h2>
              <p>From your first company to ongoing tax and compliance, {brandName} delivers the full stack of fiduciary services under one roof.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((s) => (
                <div key={s.key} className="svc-card">
                  <div className="svc-ic">{ServiceIcons[s.key]}</div>
                  <h3>{s.title}</h3>
                  <p>{s.longBlurb}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <Link href="/login" className="btn btn-primary btn-lg">Begin your application →</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
