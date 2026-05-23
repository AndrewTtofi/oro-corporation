import { prisma } from "@/lib/db";

export async function getProspectForUser(userId: string) {
  return prisma.prospect.findUnique({
    where: { userId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      bookings: { include: { expert: true }, orderBy: { startsAt: "asc" } },
      messages: { include: { sender: true }, orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}
