import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const str = (max = 600) => z.string().max(max);

const schema = z.object({
  hero: z.object({
    eyebrow: str(120), headline: str(200), lead: str(1000),
    primaryCta: str(60), secondaryCta: str(60),
  }),
  steps: z.array(z.object({ t: str(80), d: str(600) })).max(8),
  servicesIntro: z.object({ eyebrow: str(120), heading: str(200), body: str(600) }),
  stats: z.array(z.object({ v: str(40), l: str(120) })).max(8),
  testimonialsIntro: z.object({ eyebrow: str(120), heading: str(200) }),
  testimonials: z.array(z.object({ q: str(800), n: str(120), r: str(160) })).max(24),
  cta: z.object({ heading: str(200), body: str(800), button: str(60) }),
  faq: z.array(z.object({ q: str(300), a: str(2000) })).max(40),
});

/** Save the full marketing-content blob. Staff-only. */
export async function PATCH(req: Request) {
  await assertRole("staff");
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  await prisma.siteContent.upsert({
    where: { id: "singleton" },
    update: { data: parsed.data },
    create: { id: "singleton", data: parsed.data },
  });
  return NextResponse.json({ ok: true });
}
