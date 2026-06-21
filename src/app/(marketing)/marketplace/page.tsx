import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { MarketplaceTool } from "@/components/marketplace/MarketplaceTool";
import { getBranding } from "@/lib/services/branding";

export const metadata = {
  title: "Partner network",
  description: "A vetted network of banks, EMIs, corporate-service providers, advisors and licensing partners — compare and apply with one reusable KYC profile.",
};

export default async function MarketplacePage() {
  const { brandName } = await getBranding();
  return (
    <>
      <TopNav />
      <section className="section" style={{ paddingTop: "var(--space-12)" }}>
        <div className="container">
          <MarketplaceTool brand={brandName} authed={false} />
        </div>
      </section>
      <Footer />
    </>
  );
}
