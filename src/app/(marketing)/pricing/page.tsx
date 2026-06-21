import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";
import { Footer } from "@/components/marketing/Footer";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Pricing" };

type Plan = {
  tier: string;
  amount: string;
  unit: string;
  feat?: boolean;
  features: [boolean, string][];
};

const PLANS: Plan[] = [
  {
    tier: "Essentials",
    amount: "€1,200",
    unit: "one-off + from €90/mo",
    features: [
      [true, "Cyprus company formation"],
      [true, "Registered office & secretary"],
      [true, "Client dashboard & document vault"],
      [true, "Email support"],
      [false, "Accounting & VAT"],
      [false, "Banking introductions"],
      [false, "Dedicated advisor"],
    ],
  },
  {
    tier: "Standard",
    amount: "€2,400",
    unit: "setup + from €240/mo",
    feat: true,
    features: [
      [true, "Everything in Essentials"],
      [true, "Accounting & VAT compliance"],
      [true, "Annual tax filing"],
      [true, "Priority review (1 business day)"],
      [true, "Secure messaging with your advisor"],
      [true, "Deadline reminders"],
      [false, "Banking introductions"],
    ],
  },
  {
    tier: "Full service",
    amount: "Custom",
    unit: "tailored to your engagement",
    features: [
      [true, "Everything in Standard"],
      [true, "Banking introductions (25+ partners)"],
      [true, "Tax residency (Non-Dom)"],
      [true, "Immigration & relocation support"],
      [true, "AML / KYC packaging"],
      [true, "Dedicated advisor"],
      [true, "Priority support"],
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="shell-marketing">
      <TopNav />
      <main>
        <section className="section">
          <div className="mx-auto max-w-[1200px]">
            <div className="sec-head text-center mx-auto" style={{ maxWidth: "62ch", margin: "0 auto var(--space-10)" }}>
              <div className="eyebrow">PRICING</div>
              <h2>One firm. Priced to replace four.</h2>
              <p>Every engagement is delivered fully managed, with a dedicated advisor and complete visibility. No setup headaches.</p>
            </div>

            <div className="price-grid">
              {PLANS.map((p) => (
                <div key={p.tier} className={`price-card${p.feat ? " feat" : ""}`}>
                  <div className="tier">{p.tier}</div>
                  <div className="amt mono">{p.amount} <span>{p.unit}</span></div>
                  <ul>
                    {p.features.map(([on, label]) => (
                      <li key={label} className={on ? undefined : "off"}>
                        <Icon name={on ? "check" : "x"} className="ic-16" />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={`btn btn-block ${p.feat ? "btn-primary" : "btn-secondary"}`}>
                    Choose {p.tier}
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-muted mt-8" style={{ fontSize: "0.875rem" }}>
              Indicative pricing — your exact quote depends on jurisdiction and scope.{" "}
              <Link href="/login" className="text-brand">Start an application →</Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
