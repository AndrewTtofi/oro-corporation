import { TopNav } from "@/components/marketing/TopNav";
import { AdvisorChat } from "@/components/advisor/AdvisorChat";
import { getBranding } from "@/lib/services/branding";

export const metadata = {
  title: "AI Advisor",
  description: "Tell our AI advisor what you're trying to do — lower tax, set up a company, get banking, relocate — and get an instant service + jurisdiction recommendation.",
};

export default async function AdvisorPage() {
  const { brandName } = await getBranding();
  return (
    <>
      <TopNav />
      <div className="advisor-page">
        <AdvisorChat brand={brandName} />
      </div>
    </>
  );
}
