import cron from "node-cron";
import { PrismaClient, KeyDateStatus, BookingStatus } from "@prisma/client";
import { pgAdapter } from "@/lib/prisma-adapter";
import { notify } from "@/lib/providers/notify";
import { autoRescreenTick } from "./jobs/auto-rescreen";
import { periodicReviewTick } from "./jobs/periodic-review";
import { backfillCompliance } from "./jobs/backfill-compliance";

/**
 * Reminders worker.
 *  - 24h reminder: every 15 min, find bookings starting in 23h45–24h15 not yet sent
 *  - 1h reminder:  every 5 min,  find bookings starting in 0h55–1h05 not yet sent
 *  - daily 02:00 UTC: flip key_dates upcoming→overdue when past due
 *
 * Idempotent via the reminder_sent_{24h,1h} flags. Real implementation
 * fleshed out in slice 9; this entry point exists so the worker container
 * can boot from slice 2 onward.
 */
const prisma = new PrismaClient({ adapter: pgAdapter() });

async function tick24h() {
  const now = Date.now();
  const lo = new Date(now + 23.75 * 60 * 60_000);
  const hi = new Date(now + 24.25 * 60 * 60_000);
  const due = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      reminderSent24h: false,
      startsAt: { gte: lo, lte: hi },
    },
    include: { expert: true, prospect: { include: { user: true } } },
  });
  for (const b of due) {
    await notify().send({
      channel: "email",
      to: b.prospect.user.email,
      template: "reminder-24h",
      data: { expert: b.expert.fullName, when: b.startsAt.toISOString() },
    });
    if ((await notify().send({
      channel: "whatsapp",
      to: b.prospect.user.phone ?? "",
      template: "reminder-24h",
      data: { expert: b.expert.fullName, when: b.startsAt.toISOString() },
    })).ok) {
      // no-op until TWILIO_* is set; documented behavior
    }
    await prisma.booking.update({ where: { id: b.id }, data: { reminderSent24h: true } });
  }
}

async function tick1h() {
  const now = Date.now();
  const lo = new Date(now + 0.9 * 60 * 60_000);
  const hi = new Date(now + 1.1 * 60 * 60_000);
  const due = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      reminderSent1h: false,
      startsAt: { gte: lo, lte: hi },
    },
    include: { expert: true, prospect: { include: { user: true } } },
  });
  for (const b of due) {
    await notify().send({
      channel: "email",
      to: b.prospect.user.email,
      template: "reminder-1h",
      data: { expert: b.expert.fullName, when: b.startsAt.toISOString() },
    });
    await prisma.booking.update({ where: { id: b.id }, data: { reminderSent1h: true } });
  }
}

async function flipOverdueKeyDates() {
  const now = new Date();
  await prisma.keyDate.updateMany({
    where: { status: KeyDateStatus.upcoming, dueDate: { lt: now } },
    data: { status: KeyDateStatus.overdue },
  });
}

function start() {
  console.log("[worker] starting reminders + key_date scheduler");

  backfillCompliance().catch((e) => console.error("[backfill-compliance] failed:", e));

  cron.schedule("0 * * * *", () => {
    autoRescreenTick().catch((e) => console.error("[auto-rescreen] tick failed:", e));
  });
  cron.schedule("0 6 * * *", () => {
    periodicReviewTick().catch((e) => console.error("[periodic-review] tick failed:", e));
  });

  cron.schedule("*/15 * * * *", () => { void tick24h().catch((e) => console.error("[worker] 24h:", e)); });
  cron.schedule("*/5 * * * *",  () => { void tick1h().catch((e) => console.error("[worker] 1h:", e)); });
  cron.schedule("0 2 * * *",    () => { void flipOverdueKeyDates().catch((e) => console.error("[worker] keydates:", e)); });
}

start();

process.on("SIGTERM", async () => {
  console.log("[worker] SIGTERM — shutting down");
  await prisma.$disconnect();
  process.exit(0);
});
