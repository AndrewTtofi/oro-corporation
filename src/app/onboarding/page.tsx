import { ProgressBar } from "./ProgressBar";
import { ServicesPicker } from "./ServicesPicker";
import { requireUser } from "@/lib/auth/guards";
import { ensureProspect } from "@/lib/services/onboarding";

export const metadata = { title: "Select services" };

export default async function OnboardingStep1() {
  const user = await requireUser();
  const prospect = await ensureProspect(user.id);
  const preselected = Array.isArray(prospect.servicesSelected)
    ? (prospect.servicesSelected as string[])
    : [];

  return (
    <>
      <ProgressBar step={1} />
      <main className="container max-w-[1000px] pb-24">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl mb-3">What can we help you with?</h1>
          <p className="text-muted text-lg">
            Select the services you&apos;re interested in. This helps us tailor your application.
          </p>
        </div>
        <ServicesPicker initialSelected={preselected} reference={prospect.referenceNumber} />
      </main>
    </>
  );
}
