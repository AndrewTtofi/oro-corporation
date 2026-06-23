import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(args: SendArgs): Promise<{ messageId: string }>;
}

class SmtpProvider implements EmailProvider {
  private transporter: Transporter | undefined;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const e = env();
    if (!e.SMTP_HOST || !e.SMTP_PORT) {
      throw new Error("SMTP driver selected but SMTP_HOST/SMTP_PORT are not set");
    }
    this.transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    });
    return this.transporter;
  }

  async send(args: SendArgs) {
    const from = env().SMTP_FROM ?? "no-reply@localhost";
    const info = await this.getTransporter().sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { messageId: info.messageId };
  }
}

class ResendProvider implements EmailProvider {
  async send(args: SendArgs) {
    const e = env();
    if (!e.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: e.SMTP_FROM ?? "no-reply@localhost",
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        attachments: args.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { id: string };
    return { messageId: body.id };
  }
}

class ConsoleProvider implements EmailProvider {
  async send(args: SendArgs) {
    // Used in tests + when EMAIL_DRIVER=console; never silently swallow in prod.
    console.log("[email:console]", { to: args.to, subject: args.subject });
    return { messageId: `console-${Date.now()}` };
  }
}

let cached: EmailProvider | undefined;
export function email(): EmailProvider {
  if (cached) return cached;
  const driver = env().EMAIL_DRIVER;
  cached = driver === "resend" ? new ResendProvider() : driver === "console" ? new ConsoleProvider() : new SmtpProvider();
  return cached;
}
