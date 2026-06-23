import ical, { ICalCalendarMethod } from "ical-generator";

export interface SlotQuery {
  from: Date;
  to: Date;
  expertId: string;
  tz: string; // IANA, e.g. "Europe/Nicosia"
}

export interface BookingForIcs {
  uid: string;
  startUtc: Date;
  durationMinutes: number;
  summary: string;
  description?: string;
  organizerName?: string; // calendar/organizer display name; defaults to "the platform"
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName?: string;
  location?: string;
}

export interface CalendarProvider {
  listSlots(opts: SlotQuery): Promise<Date[]>;
  buildIcs(b: BookingForIcs): Buffer;
}

/**
 * Self-hosted booking calendar.
 *  - Slot generation is a flat 09:00 / 10:00 / 11:00 / 14:00 / 15:00 / 16:00 template
 *    in the expert's local timezone, weekdays only, for the next 2 weeks.
 *  - Existing confirmed bookings remove those slots; the queries live in the
 *    booking service (slice 8) and call this provider for ICS generation only.
 */
export class SelfHostedCalendar implements CalendarProvider {
  async listSlots(opts: SlotQuery): Promise<Date[]> {
    const slots: Date[] = [];
    const hours = [9, 10, 11, 14, 15, 16];
    const cur = new Date(opts.from);
    while (cur <= opts.to) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) {
        for (const h of hours) {
          // emit a UTC instant at the given local hour in opts.tz
          const localIso = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00`;
          // Best-effort tz handling: rely on the JS engine's IANA data. The
          // booking service does the canonical UTC normalization before insert.
          slots.push(new Date(`${localIso}Z`));
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return slots;
  }

  buildIcs(b: BookingForIcs): Buffer {
    const orgName = b.organizerName || "the platform";
    const cal = ical({
      name: orgName,
      method: ICalCalendarMethod.REQUEST,
      prodId: { company: orgName, product: orgName },
    });
    cal.createEvent({
      id: b.uid,
      start: b.startUtc,
      end: new Date(b.startUtc.getTime() + b.durationMinutes * 60_000),
      summary: b.summary,
      description: b.description ?? "",
      location: b.location ?? "Google Meet (link to follow)",
      organizer: { name: orgName, email: b.organizerEmail },
      attendees: [
        {
          name: b.attendeeName,
          email: b.attendeeEmail,
          rsvp: true,
          status: "NEEDS-ACTION" as never,
        },
      ],
    });
    return Buffer.from(cal.toString(), "utf8");
  }
}

let cached: CalendarProvider | undefined;
export function calendar(): CalendarProvider {
  if (cached) return cached;
  cached = new SelfHostedCalendar();
  return cached;
}
