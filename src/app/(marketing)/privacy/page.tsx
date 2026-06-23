import { LegalPage } from "@/components/marketing/LegalPage";
import { getServerBranding } from "@/lib/services/branding-server";

export const metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const { legalName, contactEmail, jurisdiction } = await getServerBranding();
  return (
    <LegalPage
      title="Privacy Policy"
      updated="19 June 2026"
      legalName={legalName}
      contactEmail={contactEmail}
      intro={`This Policy explains how ${legalName} collects, uses and protects your personal data when you use the platform. We act as data controller and process data in line with the EU GDPR.`}
      sections={[
        { h: "Data we collect", p: ["Account and contact details; identity and verification documents (passport, proof of address); business and financial information you submit; messages and documents exchanged through the platform; and technical data such as log and device information."] },
        { h: "How we use it", p: ["To provide and administer your engagement; to perform identity, source-of-funds and sanctions screening; to communicate with you; to meet legal, regulatory and accounting obligations; and to secure and improve the platform."] },
        { h: "Legal bases", p: ["We rely on performance of a contract, compliance with legal obligations, your consent (where applicable), and our legitimate interests in operating and securing the service."] },
        { h: "Storage & security", p: ["All data, including identity documents, is encrypted at rest and in transit and stored within the EU. Document files are held under AES-256 encryption and access is logged. We apply role-based access controls."] },
        { h: "Sharing", p: ["We share data only as needed to deliver your engagement: with regulated third parties (e.g. banks, registries), screening providers, and professional advisers, each under appropriate confidentiality and data-processing terms. We do not sell your data."] },
        { h: "Retention", p: ["We retain records for as long as required to provide the service and to satisfy legal and regulatory retention periods (typically several years after an engagement ends), after which data is deleted or anonymised."] },
        { h: "Your rights", p: ["Subject to law, you may access, correct, export or request deletion of your data, object to or restrict certain processing, and withdraw consent. To exercise these rights, contact us using the details below."] },
        { h: "International transfers", p: ["Where data is transferred outside the EU/EEA, we use appropriate safeguards such as adequacy decisions or standard contractual clauses."] },
        { h: "Contact", p: [`For privacy questions or to exercise your rights, contact ${legalName}${contactEmail ? ` at ${contactEmail}` : ""}. You also have the right to lodge a complaint with the ${jurisdiction} data-protection authority.`] },
      ]}
    />
  );
}
