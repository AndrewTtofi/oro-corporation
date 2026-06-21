import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  providerId: z.string().max(80),
  providerName: z.string().max(150),
  category: z.string().max(40),
});

/** Apply to a marketplace partner. Persisted against the logged-in user so it
 *  shows up under the client's "My applications". */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to apply" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const app = await prisma.application.create({
    data: {
      userId: session.user.id,
      providerId: parsed.data.providerId,
      providerName: parsed.data.providerName,
      category: parsed.data.category,
      status: "sent",
      responseBy: "within 24 hours",
    },
  });
  return NextResponse.json({ ok: true, id: app.id });
}
