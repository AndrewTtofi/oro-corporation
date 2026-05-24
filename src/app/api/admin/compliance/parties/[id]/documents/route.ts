import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { uploadDocument, MAX_BYTES } from "@/lib/services/documents";
import type { DocType } from "@prisma/client";

export const runtime = "nodejs";

const ALLOWED: DocType[] = ["passport", "proof_of_address", "other"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id: partyId } = await params;
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { complianceFile: { include: { prospect: true } } },
  });
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  if (!party.complianceFile.prospect) return NextResponse.json({ error: "Compliance file missing prospect link" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  const file = form.get("file");
  const purposeRaw = String(form.get("purpose") ?? "other");
  const typeMap: Record<string, DocType> = {
    passport: "passport",
    proof_of_address: "proof_of_address",
    sof: "other",
    other: "other",
  };
  const type = typeMap[purposeRaw];
  if (!type || !ALLOWED.includes(type)) return NextResponse.json({ error: "Invalid purpose" }, { status: 422 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadDocument({
    prospectId: party.complianceFile.prospect.id,
    userId: me.id,
    type,
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    buffer,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });

  // Link the freshly-uploaded document to the party with the requested purpose
  await prisma.document.update({
    where: { id: result.doc.id },
    data: { partyId, purpose: purposeRaw as never },
  });
  return NextResponse.json({ ok: true, documentId: result.doc.id });
}
