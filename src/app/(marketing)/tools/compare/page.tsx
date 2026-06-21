import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { CompareTool } from "./CompareTool";
import { RATES_REVIEWED } from "@/lib/data/jurisdictions";

export const metadata = {
  title: "Compare jurisdictions",
  description: "Compare 18+ corporate jurisdictions side by side — corporate tax, VAT, formation time, minimum capital and tax treaties.",
};

export default async function ComparePage() {
  return (
    <>
      <TopNav />
      <section className="section">
        <div className="container">
          <div className="sec-head">
            <div className="eyebrow">FREE TOOL</div>
            <h2>Compare jurisdictions side by side.</h2>
            <p>Select the jurisdictions you are weighing up. Best value in each column is highlighted.</p>
          </div>
          <CompareTool />
          <p className="muted mt-6" style={{ fontSize: "var(--fs-xs)", maxWidth: "80ch" }}>
            Corporate income tax and VAT/GST figures verified against{" "}
            <a href="https://taxsummaries.pwc.com" target="_blank" rel="noreferrer noopener" className="link-gold">PwC Worldwide Tax Summaries</a>
            {" "}(reviewed {RATES_REVIEWED}); each row links to its source. Headline rates simplify many
            special regimes, and formation time, minimum capital and treaty counts are indicative.
            This is general information, not tax advice — verify before relying.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
