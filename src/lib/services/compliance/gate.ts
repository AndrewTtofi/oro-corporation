import { prisma } from "@/lib/db";

export type GateOk = { ok: true };
export type GateFail = { ok: false; reason: "compliance_not_cleared" | "compliance_blocked" | "no_compliance_file" };

export async function checkComplianceGateForProspect(prospectId: string): Promise<GateOk | GateFail> {
  const file = await prisma.complianceFile.findUnique({ where: { prospectId }, select: { status: true } });
  if (!file) return { ok: false, reason: "no_compliance_file" };
  if (file.status === "blocked") return { ok: false, reason: "compliance_blocked" };
  if (file.status !== "cleared") return { ok: false, reason: "compliance_not_cleared" };
  return { ok: true };
}
