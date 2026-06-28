import { redirect } from "next/navigation";
import { ProgressBar } from "../ProgressBar";
import { PhaseIntro } from "../PhaseIntro";
import { DocumentUploader } from "./DocumentUploader";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getBranding } from "@/lib/services/branding";
import { getDocumentsPhase } from "@/lib/services/settings";

export const metadata = { title: "Upload documents" };

export default async function OnboardingStep3() {
  const user = await requireUser();
  const documentsPhase = await getDocumentsPhase();
  // When the documents phase is disabled it is finalised at step 2, so this
  // step does not exist — send anyone who lands here onward.
  if (documentsPhase === "off") redirect("/onboarding/success");
  const { brandName } = await getBranding();
  const prospect = await prisma.prospect.findUnique({
    where: { userId: user.id },
    include: { documents: true },
  });
  if (!prospect) redirect("/onboarding");
  if (!Array.isArray(prospect.servicesSelected) || prospect.servicesSelected.length === 0) {
    redirect("/onboarding");
  }
  if (!prospect.draft) redirect("/onboarding/details");

  const passport = prospect.documents.find((d) => d.type === "passport") ?? null;
  const proof = prospect.documents.find((d) => d.type === "proof_of_address") ?? null;
  const extras = prospect.documents.filter((d) => d.type === "other");

  return (
    <>
      <ProgressBar step={3} totalSteps={3} />
      <main className="container max-w-[800px] pb-24">
        <PhaseIntro
          title="Secure document upload"
          subtitle={
            documentsPhase === "optional"
              ? "Upload supporting documents to speed up your review. These are optional — you can submit without them."
              : "Please provide the following documents to complete your application review."
          }
        />

        <DocumentUploader
          mode={documentsPhase}
          initial={{
            passport: passport && { id: passport.id, name: passport.originalName, size: passport.sizeBytes },
            proof: proof && { id: proof.id, name: proof.originalName, size: proof.sizeBytes },
            extras: extras.map((d) => ({ id: d.id, name: d.originalName, size: d.sizeBytes })),
          }}
        />

        <p className="text-meta text-muted text-center max-w-[55ch] mx-auto mt-10 leading-relaxed">
          Your documents are encrypted and stored securely in compliance with GDPR.
          Only authorized {brandName} staff and assigned professionals will have access to your data.
        </p>
      </main>
    </>
  );
}
