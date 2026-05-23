import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export const runtime = "nodejs";

const schema = z.object({
  description: z.string().min(2).max(200),
  dueDate: z.coerce.date(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await assertRole("staff");
  const { id } = await params;

  // Accept both JSON and form-encoded payloads (the inline form on the
  // client-profile page posts form data).
  let payload: { description?: string; dueDate?: string } = {};
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    payload = await req.json().catch(() => ({}));
  } else {
    const form = await req.formData().catch(() => null);
    if (form) {
      payload = {
        description: form.get("description")?.toString(),
        dueDate: form.get("dueDate")?.toString(),
      };
    }
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  await prisma.keyDate.create({
    data: { clientId: id, description: parsed.data.description, dueDate: parsed.data.dueDate },
  });
  await logActivity({
    entityType: "client",
    entityId: id,
    action: "client.key_date_added",
    actorId: user.id,
    meta: { description: parsed.data.description, dueDate: parsed.data.dueDate.toISOString() },
  });

  // Form submissions expect a 303 redirect back to the profile.
  if (!ct.includes("application/json")) {
    return NextResponse.redirect(new URL(`/admin/clients/${id}`, req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
