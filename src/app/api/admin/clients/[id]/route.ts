import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateClientProfile, updatePrimaryStaff, updateClientStatus } from "@/lib/services/clients";
import { prisma } from "@/lib/db";
import type { ClientStatus } from "@prisma/client";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["active", "on_hold", "completed"]).optional(),
  primaryStaffId: z.string().uuid().optional(),
  companyName: z.string().max(200).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  registrationNumber: z.string().max(60).nullable().optional(),
  vatNumber: z.string().max(40).nullable().optional(),
  taxResidency: z.string().length(2).nullable().optional(),
  engagementLetterDate: z.string().date().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  // Pre-validate so partial multi-write failure is rare. The three service
  // calls are not yet wrapped in a shared transaction — if any throws after
  // the first succeeded, that earlier write is committed. Most common failure
  // modes (bad client id, bad primary staff target) are caught here.
  const exists = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (body.data.primaryStaffId !== undefined) {
    const target = await prisma.user.findUnique({ where: { id: body.data.primaryStaffId }, select: { role: true } });
    if (!target) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    if (target.role !== "staff") return NextResponse.json({ error: "New primary must be a staff user" }, { status: 400 });
  }

  try {
    if (body.data.status !== undefined) {
      await updateClientStatus(id, body.data.status as ClientStatus, me.id);
    }
    if (body.data.primaryStaffId !== undefined) {
      await updatePrimaryStaff(id, body.data.primaryStaffId, me.id);
    }
    const { status: _status, primaryStaffId: _ps, ...profile } = body.data;
    if (Object.keys(profile).length > 0) {
      await updateClientProfile(id, profile, me.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
