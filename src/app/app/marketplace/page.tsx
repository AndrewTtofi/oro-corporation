import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client/ClientShell";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { MarketplaceTool } from "@/components/marketplace/MarketplaceTool";
import { getBranding } from "@/lib/services/branding";

export const metadata = { title: "Partner network" };
export const dynamic = "force-dynamic";

export default async function ClientMarketplacePage() {
  const user = await requireUser();
  const [prospect, client, branding] = await Promise.all([
    prisma.prospect.findUnique({ where: { userId: user.id } }),
    prisma.client.findUnique({ where: { userId: user.id } }),
    getBranding(),
  ]);
  if (!prospect) redirect("/onboarding");
  const approved = prospect.status === "approved" || !!client;
  return (
    <ClientShell active="marketplace" approved={approved}>
      <MarketplaceTool brand={branding.brandName} authed />
    </ClientShell>
  );
}
