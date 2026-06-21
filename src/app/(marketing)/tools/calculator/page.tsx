import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { CalculatorTool } from "./CalculatorTool";

export const metadata = {
  title: "Tax calculator",
  description: "Estimate your corporate tax savings across jurisdictions. Free, illustrative comparison.",
};

export default async function CalculatorPage() {
  return (
    <>
      <TopNav />
      <section className="section">
        <div className="container">
          <div className="sec-head">
            <div className="eyebrow">FREE TOOL · LEAD MAGNET</div>
            <h2>Estimate your tax savings.</h2>
            <p>A rough, illustrative comparison of corporate tax on your profit. Enter your email to reveal the full breakdown.</p>
          </div>
          <CalculatorTool />
        </div>
      </section>
      <Footer />
    </>
  );
}
