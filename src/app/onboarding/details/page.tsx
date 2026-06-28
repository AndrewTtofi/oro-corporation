import { redirect } from "next/navigation";
import { ProgressBar } from "../ProgressBar";
import { PhaseIntro } from "../PhaseIntro";
import { DetailsForm } from "./DetailsForm";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { getDocumentsPhase } from "@/lib/services/settings";

export const metadata = { title: "Your details" };

export default async function OnboardingStep2() {
  const user = await requireUser();
  const prospect = await prisma.prospect.findUnique({ where: { userId: user.id } });
  if (!prospect) redirect("/onboarding");
  if (!Array.isArray(prospect.servicesSelected) || prospect.servicesSelected.length === 0) {
    redirect("/onboarding");
  }

  const services = prospect.servicesSelected as string[];
  const draft = (prospect.draft as Record<string, unknown> | null) ?? {};
  const documentsPhase = await getDocumentsPhase();
  const totalSteps = documentsPhase === "off" ? 2 : 3;

  return (
    <>
      <ProgressBar step={2} totalSteps={totalSteps} />
      <PhaseIntro
        title="Your details"
        subtitle="Tell us about you and your goals so we can tailor your application."
      />
      <DetailsForm
        services={services}
        initialDraft={draft}
        reference={prospect.referenceNumber}
        userFullName={user.fullName ?? user.email}
        documentsPhase={documentsPhase}
      />
    </>
  );
}
