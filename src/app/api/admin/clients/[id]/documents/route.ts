import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { uploadDocument, MAX_BYTES } from "@/lib/services/documents";
import type { DocPurpose, DocType } from "@prisma/client";

export const runtime = "nodejs";

const ALLOWED: DocType[] = ["passport", "proof_of_address", "other"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id: clientId } = await params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { prospectId: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });

  const file = form.get("file");
  const purposeRaw = String(form.get("purpose") ?? "other");
  const serviceTypeKey = form.get("serviceTypeKey")?.toString() || null;
  const fulfillsRequestId = form.get("fulfillsRequestId")?.toString() || null;

  const typeMap: Record<string, DocType> = {
    passport: "passport",
    proof_of_address: "proof_of_address",
    sof: "other",
    other: "other",
  };
  const purposeMap: Record<string, DocPurpose> = {
    passport: "passport",
    proof_of_address: "proof_of_address",
    sof: "sof",
    other: "other",
  };
  const type = typeMap[purposeRaw];
  const purpose = purposeMap[purposeRaw];
  if (!type || !ALLOWED.includes(type) || !purpose) return NextResponse.json({ error: "Invalid purpose" }, { status: 422 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadDocument({
    prospectId: client.prospectId,
    userId: me.id,
    type,
    purpose,
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    buffer,
    serviceTypeKey,
    fulfillsRequestId,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json({ ok: true, documentId: result.doc.id });
}
