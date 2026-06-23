import { features, env } from "@/lib/env";
import { email } from "./email";

export type NotifyChannel = "email" | "whatsapp";

export interface NotifyArgs {
  channel: NotifyChannel;
  to: string;
  template: "booking-confirmation" | "reminder-24h" | "reminder-1h" | "submission-update";
  data: Record<string, unknown>;
}

export interface NotificationProvider {
  send(args: NotifyArgs): Promise<{ ok: boolean }>;
}

class DefaultNotificationProvider implements NotificationProvider {
  async send(args: NotifyArgs): Promise<{ ok: boolean }> {
    if (args.channel === "email") {
      await email().send({
        to: args.to,
        subject: renderSubject(args),
        html: renderHtml(args),
      });
      return { ok: true };
    }
    if (args.channel === "whatsapp") {
      if (!features.whatsapp) {
        // Env-gated no-op until TWILIO_* is set; documented behavior.
        return { ok: false };
      }
      return sendWhatsApp(args);
    }
    return { ok: false };
  }
}

async function sendWhatsApp(args: NotifyArgs): Promise<{ ok: boolean }> {
  const e = env();
  const auth = Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({
    From: `whatsapp:${e.TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:${args.to}`,
    Body: renderText(args),
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  return { ok: res.ok };
}

function renderSubject(a: NotifyArgs): string {
  switch (a.template) {
    case "booking-confirmation": return "Your consultation is confirmed";
    case "reminder-24h":         return "Reminder: your consultation is tomorrow";
    case "reminder-1h":          return "Reminder: your consultation is in 1 hour";
    case "submission-update":    return `Your application ${a.data.reference ?? ""}`.trim();
  }
}

function renderHtml(a: NotifyArgs): string {
  // Replaced by real MJML/HTML templates in slice 3+. Plain text fallback is fine.
  return `<p>${renderText(a)}</p>`;
}

function renderText(a: NotifyArgs): string {
  if (a.template === "booking-confirmation") {
    return `Your consultation with ${a.data.expert} on ${a.data.when} is confirmed.`;
  }
  if (a.template === "reminder-24h" || a.template === "reminder-1h") {
    return `Reminder: consultation with ${a.data.expert} at ${a.data.when}.`;
  }
  if (a.template === "submission-update") {
    return `Application ${a.data.reference}: status is now ${a.data.status}.`;
  }
  return "You have a new notification.";
}

let cached: NotificationProvider | undefined;
export function notify(): NotificationProvider {
  if (cached) return cached;
  cached = new DefaultNotificationProvider();
  return cached;
}
