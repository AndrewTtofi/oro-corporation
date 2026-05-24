import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const DOMAIN_TABLES = [
  "DocumentRequest", "Message", "InternalNote", "Booking",
  "ReviewTask", "ScreeningHit", "ScreeningRun", "KycCase", "Party", "ComplianceFile",
  "Document", "KeyDate", "ClientService", "Client", "Prospect",
  "ActivityLog", "PasswordReset", "VerificationToken", "Session", "Account",
  "User", "OrgSettings", "Service", "FeatureFlag",
];

export async function POST() {
  if (process.env.NODE_ENV !== "test" && process.env.ALLOW_TEST_RESET !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${DOMAIN_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  return NextResponse.json({ ok: true });
}
