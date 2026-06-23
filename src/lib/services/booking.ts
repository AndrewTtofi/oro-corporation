import { prisma } from "@/lib/db";
import { BookingStatus, Role } from "@prisma/client";
import { calendar } from "@/lib/providers/calendar";
import { notify } from "@/lib/providers/notify";
import { getServerBranding } from "@/lib/services/branding-server";
import { logActivity } from "./activity";

const SLOT_HOURS = [9, 10, 11, 14, 15, 16] as const;

/** All staff who can be picked as experts on the booking page. */
export async function listExperts() {
  return prisma.user.findMany({
    where: { role: Role.staff },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
}

/** Generate the 2-week availability matrix for a given expert. Pure function
 *  over the database — no IO outside `prisma.findMany`. */
export async function listAvailability(expertId: string, tz: string) {
  const now = new Date();
  const horizonEnd = new Date(Date.now() + 14 * 24 * 60 * 60_000);

  const taken = await prisma.booking.findMany({
    where: {
      expertId,
      status: { in: [BookingStatus.confirmed, BookingStatus.completed] },
      startsAt: { gte: now, lte: horizonEnd },
    },
    select: { startsAt: true },
  });
  const takenKey = new Set(taken.map((b) => keyOf(b.startsAt)));

  // Build a per-day slot list in UTC. The tz is used purely for display.
  const days: { dateIso: string; slots: { startUtc: Date; available: boolean }[] }[] = [];
  for (let dayIdx = 0; dayIdx < 14; dayIdx++) {
    const d = new Date(now.getTime() + dayIdx * 24 * 60 * 60_000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue; // skip weekends
    const slots: { startUtc: Date; available: boolean }[] = [];
    for (const h of SLOT_HOURS) {
      const slot = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, 0, 0));
      if (slot < now) continue;
      slots.push({ startUtc: slot, available: !takenKey.has(keyOf(slot)) });
    }
    if (slots.length > 0) {
      days.push({ dateIso: d.toISOString().slice(0, 10), slots });
    }
  }
  return { tz, days };
}

function keyOf(d: Date): string {
  return d.toISOString();
}

export interface CreateBookingInput {
  userId: string;
  expertId: string;
  startUtc: Date;
  timezone: string;
}

export async function createBooking(input: CreateBookingInput) {
  const prospect = await prisma.prospect.findUnique({
    where: { userId: input.userId },
    include: { user: true },
  });
  if (!prospect) return { ok: false as const, reason: "NO_PROSPECT" as const };
  if (prospect.status !== "approved") return { ok: false as const, reason: "NOT_APPROVED" as const };

  // Conflict check at insert time — the unique constraint isn't on (expertId, startsAt)
  // by design (cancellations can free a slot), so check explicitly.
  const existing = await prisma.booking.findFirst({
    where: {
      expertId: input.expertId,
      startsAt: input.startUtc,
      status: { in: [BookingStatus.confirmed, BookingStatus.completed] },
    },
  });
  if (existing) return { ok: false as const, reason: "SLOT_TAKEN" as const };

  const booking = await prisma.booking.create({
    data: {
      prospectId: prospect.id,
      expertId: input.expertId,
      startsAt: input.startUtc,
      timezone: input.timezone,
      status: BookingStatus.confirmed,
    },
    include: { expert: true },
  });

  await logActivity({
    entityType: "booking",
    entityId: booking.id,
    action: "booking.created",
    actorId: input.userId,
    meta: { startsAt: input.startUtc.toISOString(), expertId: input.expertId },
  });

  // Fire-and-forget confirmation + .ics
  const brand = await getServerBranding();
  const ics = calendar().buildIcs({
    uid: `booking-${booking.id}@booking.local`,
    startUtc: booking.startsAt,
    durationMinutes: booking.durationMinutes,
    summary: `${brand.legalName} — consultation`,
    description: `Free consultation with ${brand.legalName}.`,
    organizerName: brand.legalName,
    organizerEmail: brand.contactEmail ?? "no-reply@localhost",
    attendeeEmail: prospect.user.email,
    attendeeName: prospect.user.fullName,
    location: "Google Meet (link to follow)",
  });

  await notify().send({
    channel: "email",
    to: prospect.user.email,
    template: "booking-confirmation",
    data: {
      expert: booking.expert.fullName,
      when: booking.startsAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: booking.timezone }),
    },
  });

  return { ok: true as const, booking, ics };
}

export async function cancelBooking(userId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { prospect: true } });
  if (!booking) return { ok: false as const, reason: "NOT_FOUND" as const };
  if (booking.prospect.userId !== userId) return { ok: false as const, reason: "FORBIDDEN" as const };
  if (booking.status !== BookingStatus.confirmed) return { ok: false as const, reason: "NOT_CANCELLABLE" as const };
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.cancelled },
  });
  await logActivity({
    entityType: "booking",
    entityId: bookingId,
    action: "booking.cancelled",
    actorId: userId,
  });
  return { ok: true as const, booking: updated };
}
