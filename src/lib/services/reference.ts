import { prisma } from "@/lib/db";
import { getServerBranding } from "@/lib/services/branding-server";

/**
 * Allocates a unique reference number of the form `{PREFIX}-{year}-{NNNNN}`,
 * where PREFIX is the white-label reference prefix from org settings (e.g.
 * "ORO"). Uses a per-year counter derived from the highest existing number;
 * collisions during burst load are caught by the @unique constraint and retried.
 */
export async function allocateReferenceNumber(year = new Date().getFullYear()): Promise<string> {
  const { referencePrefix: PREFIX } = await getServerBranding();
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.prospect.findFirst({
      where: { referenceNumber: { startsWith: `${PREFIX}-${year}-` } },
      orderBy: { referenceNumber: "desc" },
      select: { referenceNumber: true },
    });
    const next = last
      ? (Number(last.referenceNumber.split("-").pop()!) + 1)
      : 1;
    const candidate = `${PREFIX}-${year}-${String(next).padStart(5, "0")}`;
    const exists = await prisma.prospect.findUnique({ where: { referenceNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new Error("Could not allocate reference number after 5 attempts");
}
