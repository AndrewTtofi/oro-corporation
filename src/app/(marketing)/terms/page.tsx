import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="19 June 2026"
      intro="These Terms govern your access to and use of the ORO platform and the corporate-services engagements offered through it. By creating an account or submitting an application, you agree to these Terms."
      sections={[
        { h: "Eligibility & accounts", p: ["You must be at least 18 and able to enter a binding contract. You are responsible for the accuracy of the information you provide and for keeping your account credentials secure.", "We may decline, suspend or terminate an account where information is incomplete, where compliance checks cannot be satisfied, or where use breaches these Terms."] },
        { h: "Applications & onboarding", p: ["Submitting an application does not create an engagement. Consultations and services are offered only after identity verification and compliance review. Approval is at our discretion."] },
        { h: "Services & fees", p: ["The scope and fees for each engagement are confirmed in writing before work begins. Indicative pricing on the site is illustrative and does not constitute an offer.", "Fees are payable as set out in your engagement letter. Third-party costs (e.g. government, registry and bank charges) are passed through."] },
        { h: "Your responsibilities", p: ["You agree to provide complete and truthful information, to respond to document requests promptly, and not to use the platform for unlawful purposes, including money laundering, sanctions evasion or fraud."] },
        { h: "Compliance & KYC/AML", p: ["We are required to perform identity, source-of-funds and sanctions screening. We may request additional documentation at any time and may pause or end an engagement to meet our legal obligations."] },
        { h: "Intellectual property", p: ["The platform, its content and software are owned by ORO Corporate Services Limited or its licensors. You receive a limited, non-transferable right to use the platform for your engagement."] },
        { h: "Liability", p: ["To the extent permitted by law, our aggregate liability is limited to the fees paid for the relevant engagement. We are not liable for indirect or consequential loss. Nothing limits liability that cannot be excluded by law."] },
        { h: "Termination", p: ["Either party may terminate an engagement in accordance with the engagement letter. On termination you may request export of your records, subject to our retention obligations."] },
        { h: "Governing law", p: ["These Terms are governed by the laws of the Republic of Cyprus, and the courts of Cyprus have exclusive jurisdiction, subject to any mandatory consumer protections that apply to you."] },
      ]}
    />
  );
}
