import { PrismaClient, Role, ProspectStatus, DocType, DocStatus, ClientStatus, SvcStatus, KeyDateStatus, BookingStatus } from "@prisma/client";
import argon2 from "argon2";
import { pgAdapter } from "@/lib/prisma-adapter";

const prisma = new PrismaClient({ adapter: pgAdapter() });

/**
 * Idempotent demo seed: 1 staff, 1 partner, 3 prospects in different statuses,
 * and 1 converted client with services + key_dates + a confirmed booking.
 * Re-runnable; uses upserts + skipDuplicates to stay safe on repeat boots.
 */
export async function runSeed() {
  const password = await argon2.hash("oroDemo!1", { type: argon2.argon2id });

  const staff = await prisma.user.upsert({
    where: { email: "staff@oro.local" },
    update: {},
    create: { email: "staff@oro.local", passwordHash: password, fullName: "Eleni Christodoulou", role: Role.staff, emailVerified: new Date() },
  });

  const partner = await prisma.user.upsert({
    where: { email: "partner@oro.local" },
    update: {},
    create: { email: "partner@oro.local", passwordHash: password, fullName: "Maria Georgiou", role: Role.partner, emailVerified: new Date() },
  });

  // Pending prospect
  const pendingUser = await prisma.user.upsert({
    where: { email: "alex.r@uae-invest.com" },
    update: {},
    create: { email: "alex.r@uae-invest.com", passwordHash: password, fullName: "Alexander Romanov", phone: "+971501112233", role: Role.prospect, emailVerified: new Date() },
  });
  const pendingProspect = await prisma.prospect.upsert({
    where: { userId: pendingUser.id },
    update: {},
    create: { userId: pendingUser.id, referenceNumber: "ORO-2026-00142", status: ProspectStatus.pending, servicesSelected: ["company_formation"] },
  });
  // Idempotent: these tables have no natural unique key, so `skipDuplicates`
  // can't prevent re-seeding from piling up duplicates on every boot. Clear the
  // seeded entity's rows first, then re-create.
  await prisma.prospectDetail.deleteMany({ where: { prospectId: pendingProspect.id } });
  await prisma.prospectDetail.createMany({
    skipDuplicates: true,
    data: [
      { prospectId: pendingProspect.id, fieldName: "nationality", fieldValue: "Russia" },
      { prospectId: pendingProspect.id, fieldName: "residence", fieldValue: "United Arab Emirates" },
      { prospectId: pendingProspect.id, fieldName: "expected_turnover", fieldValue: "EUR 200K - 500K" },
      { prospectId: pendingProspect.id, fieldName: "timeline", fieldValue: "Within 1 month" },
      { prospectId: pendingProspect.id, fieldName: "business_description", fieldValue: "Software development agency focusing on fintech solutions for the EU market. Planning to hire 3 developers in Cyprus within the first year." },
    ],
  });
  await prisma.document.deleteMany({ where: { prospectId: pendingProspect.id } });
  await prisma.document.createMany({
    skipDuplicates: true,
    data: [
      { prospectId: pendingProspect.id, type: DocType.passport, storageKey: `prospects/${pendingProspect.id}/passport.pdf`, encMeta: { alg: "aes-256-gcm", ivB64: "", tagB64: "", keyId: "seed" }, originalName: "Passport_Romanov.pdf", mime: "application/pdf", sizeBytes: 2_400_000, status: DocStatus.received },
      { prospectId: pendingProspect.id, type: DocType.proof_of_address, storageKey: `prospects/${pendingProspect.id}/proof.jpg`, encMeta: { alg: "aes-256-gcm", ivB64: "", tagB64: "", keyId: "seed" }, originalName: "Utility_Bill_May2026.jpg", mime: "image/jpeg", sizeBytes: 1_100_000, status: DocStatus.received },
    ],
  });

  // Needs-info prospect
  const niUser = await prisma.user.upsert({
    where: { email: "david@cohen-tech.io" },
    update: {},
    create: { email: "david@cohen-tech.io", passwordHash: password, fullName: "David Cohen", role: Role.prospect, emailVerified: new Date() },
  });
  await prisma.prospect.upsert({
    where: { userId: niUser.id },
    update: {},
    create: { userId: niUser.id, referenceNumber: "ORO-2026-00140", status: ProspectStatus.needs_info, servicesSelected: ["banking", "licensing"] },
  });

  // Approved prospect (ready to book)
  const approvedUser = await prisma.user.upsert({
    where: { email: "elena.p@limassol.cy" },
    update: {},
    create: { email: "elena.p@limassol.cy", passwordHash: password, fullName: "Elena Papadopoulos", role: Role.prospect, emailVerified: new Date() },
  });
  await prisma.prospect.upsert({
    where: { userId: approvedUser.id },
    update: {},
    create: { userId: approvedUser.id, referenceNumber: "ORO-2026-00141", status: ProspectStatus.approved, servicesSelected: ["tax_residency"], reviewedAt: new Date(), reviewedById: staff.id },
  });

  // Converted client (origin of admin-client-profile.html demo data)
  const clientUser = await prisma.user.upsert({
    where: { email: "dmitry@meridian.io" },
    update: {},
    create: { email: "dmitry@meridian.io", passwordHash: password, fullName: "Dmitry Volkov", phone: "+357991234567", role: Role.client, emailVerified: new Date() },
  });
  const clientProspect = await prisma.prospect.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id, referenceNumber: "ORO-2026-00089", status: ProspectStatus.approved, servicesSelected: ["company_formation", "banking"], reviewedAt: new Date("2026-01-14"), reviewedById: staff.id },
  });
  const client = await prisma.client.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id, prospectId: clientProspect.id, companyName: "Meridian Trading Ltd", status: ClientStatus.active, primaryStaffId: staff.id, createdAt: new Date("2026-01-15") },
  });
  await prisma.clientService.deleteMany({ where: { clientId: client.id } });
  await prisma.clientService.createMany({
    skipDuplicates: true,
    data: [
      { clientId: client.id, serviceType: "company_formation", status: SvcStatus.in_progress, assignedPartnerId: partner.id, startDate: new Date("2026-01-15"), notes: "Registering with Registrar of Companies. Name 'Meridian Trading' approved." },
      { clientId: client.id, serviceType: "banking", status: SvcStatus.pending, assignedPartnerId: partner.id, startDate: new Date("2026-01-20"), notes: "Bank of Cyprus application submitted. Awaiting KYC approval." },
    ],
  });
  await prisma.keyDate.deleteMany({ where: { clientId: client.id } });
  await prisma.keyDate.createMany({
    skipDuplicates: true,
    data: [
      { clientId: client.id, description: "VAT Filing (Q2)", dueDate: new Date("2026-06-15"), status: KeyDateStatus.upcoming },
      { clientId: client.id, description: "Annual Return Submission", dueDate: new Date("2026-08-12"), status: KeyDateStatus.upcoming },
      { clientId: client.id, description: "Passport Renewal Reminder", dueDate: new Date("2026-05-20"), status: KeyDateStatus.overdue },
    ],
  });
  await prisma.internalNote.deleteMany({ where: { clientId: client.id } });
  await prisma.internalNote.createMany({
    skipDuplicates: true,
    data: [
      { clientId: client.id, authorId: partner.id, body: "Dmitry mentioned he might want to open a secondary branch in Estonia later this year. Keep in mind for cross-border tax planning.", createdAt: new Date("2026-05-10") },
      { clientId: client.id, authorId: staff.id, body: "Waiting for the signed engagement letter for the banking module.", createdAt: new Date("2026-05-05") },
    ],
  });
  await prisma.booking.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", prospectId: clientProspect.id, expertId: staff.id, startsAt: new Date("2026-06-10T08:00:00Z"), timezone: "Europe/Nicosia", durationMinutes: 45, status: BookingStatus.confirmed },
  });

  return {
    accounts: {
      staff: "staff@oro.local",
      partner: "partner@oro.local",
      prospects: ["alex.r@uae-invest.com (pending)", "david@cohen-tech.io (needs_info)", "elena.p@limassol.cy (approved)"],
      client: "dmitry@meridian.io",
      password: "oroDemo!1",
    },
  };
}

// Standalone execution path (used in production by the entrypoint and in dev by tsx).
if (require.main === module) {
  runSeed()
    .then((r) => {
      console.log("[seed] complete:", r.accounts);
    })
    .catch((e) => {
      console.error("[seed] failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
