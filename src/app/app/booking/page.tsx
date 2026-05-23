import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { listExperts } from "@/lib/services/booking";
import { BookingFlow } from "./BookingFlow";

export const metadata = { title: "Book consultation" };

export default async function BookingPage() {
  const user = await requireUser();
  const prospect = await prisma.prospect.findUnique({ where: { userId: user.id } });
  if (!prospect) redirect("/onboarding");

  if (prospect.status !== "approved") {
    return (
      <ClientShell active="booking" approved={false}>
        <div className="max-w-[600px] mx-auto text-center mt-16">
          <h1 className="font-display text-3xl mb-3">Booking unavailable</h1>
          <p className="text-muted">
            Your application status is <b>{prospect.status}</b>. Booking unlocks
            once your application is approved.
          </p>
        </div>
      </ClientShell>
    );
  }

  const experts = await listExperts();
  return (
    <ClientShell active="booking" approved>
      <BookingFlow experts={experts} reference={prospect.referenceNumber} />
    </ClientShell>
  );
}
