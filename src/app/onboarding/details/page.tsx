import { redirect } from "next/navigation";
import { ProgressBar } from "../ProgressBar";
import { DetailsForm } from "./DetailsForm";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

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

  return (
    <>
      <ProgressBar step={2} />
      <DetailsForm
        services={services}
        initialDraft={draft}
        reference={prospect.referenceNumber}
        userFullName={user.fullName ?? user.email}
      />
    </>
  );
}
