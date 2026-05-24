import { prisma } from "@/lib/db";

export async function backfillCompliance() {
  const start = Date.now();
  const prospectsMissing = await prisma.prospect.findMany({
    where: { complianceFile: null },
    include: { user: true },
    take: 1000,
  });
  let created = 0;
  for (const p of prospectsMissing) {
    await prisma.$transaction(async (tx) => {
      const cf = await tx.complianceFile.create({ data: { prospectId: p.id, status: "open" } });
      const party = await tx.party.create({
        data: { complianceFileId: cf.id, type: "individual", role: "main_contact", fullName: p.user.fullName },
      });
      await tx.kycCase.create({ data: { partyId: party.id } });
    });
    created += 1;
  }

  const clientsMissing = await prisma.client.findMany({
    where: { complianceFile: null },
    include: { user: true, prospect: true },
    take: 1000,
  });
  for (const c of clientsMissing) {
    // Reuse the prospect's file if it exists, else create + link client.
    const existing = await prisma.complianceFile.findUnique({ where: { prospectId: c.prospectId } });
    if (existing) {
      await prisma.complianceFile.update({ where: { id: existing.id }, data: { clientId: c.id } });
    } else {
      await prisma.$transaction(async (tx) => {
        const cf = await tx.complianceFile.create({
          data: { prospectId: c.prospectId, clientId: c.id, status: "open" },
        });
        const party = await tx.party.create({
          data: { complianceFileId: cf.id, type: "individual", role: "main_contact", fullName: c.user.fullName },
        });
        await tx.kycCase.create({ data: { partyId: party.id } });
      });
      created += 1;
    }
  }
  console.log("[backfill-compliance] created=%d durationMs=%d", created, Date.now() - start);
}
