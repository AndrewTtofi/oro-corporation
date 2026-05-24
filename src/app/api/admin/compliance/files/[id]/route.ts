import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertRole("staff");
  const { id } = await params;
  const file = await prisma.complianceFile.findUnique({
    where: { id },
    include: {
      parties: {
        include: {
          kycCase: {
            include: {
              latestScreeningRun: { include: { hits: true } },
            },
          },
        },
      },
      reviewTasks: { where: { state: "open" }, orderBy: { createdAt: "desc" } },
      signedOff: { select: { id: true, fullName: true, email: true } },
      riskAssessedBy: { select: { id: true, fullName: true } },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ file });
}
