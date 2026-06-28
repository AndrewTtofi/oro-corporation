import { ProgressBar } from "./ProgressBar";
import { PhaseIntro } from "./PhaseIntro";
import { ServicesPicker } from "./ServicesPicker";
import { requireUser } from "@/lib/auth/guards";
import { ensureProspect } from "@/lib/services/onboarding";
import { getDocumentsPhase } from "@/lib/services/settings";

export const metadata = { title: "Select services" };

export default async function OnboardingStep1() {
  const user = await requireUser();
  const prospect = await ensureProspect(user.id);
  const documentsPhase = await getDocumentsPhase();
  const totalSteps = documentsPhase === "off" ? 2 : 3;
  const preselected = Array.isArray(prospect.servicesSelected)
    ? (prospect.servicesSelected as string[])
    : [];

  return (
    <>
      <ProgressBar step={1} totalSteps={totalSteps} />
      <main className="container max-w-[1000px] pb-24">
        <PhaseIntro
          title="What can we help you with?"
          subtitle="Select the services you're interested in. This helps us tailor your application."
        />
        <ServicesPicker initialSelected={preselected} reference={prospect.referenceNumber} />
      </main>
    </>
  );
}
