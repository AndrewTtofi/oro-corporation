import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { uploadDocument, MAX_BYTES } from "@/lib/services/documents";
import { rateLimit } from "@/lib/rate-limit";
import type { DocType } from "@prisma/client";

export const runtime = "nodejs";

const ALLOWED_TYPES: DocType[] = ["passport", "proof_of_address", "other"];

export async function POST(req: Request) {
  const user = await assertRole("prospect", "client", "staff");

  const limit = await rateLimit({ bucket: "upload", key: user.id, limit: 30, windowSec: 600 });
  if (!limit.ok) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  // Quick CT check before parsing — multipart only.
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 415 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const type = form.get("type")?.toString() as DocType | undefined;
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 422 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const prospect = await prisma.prospect.findUnique({ where: { userId: user.id } });
  if (!prospect) return NextResponse.json({ error: "No application in progress" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await uploadDocument({
    prospectId: prospect.id,
    userId: user.id,
    type,
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    buffer,
  });
  if (!result.ok) {
    if (result.reason === "BAD_MIME") return NextResponse.json({ error: "PDF, JPG, or PNG only" }, { status: 415 });
    if (result.reason === "TOO_LARGE") return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: {
      id: result.doc.id,
      type: result.doc.type,
      originalName: result.doc.originalName,
      sizeBytes: result.doc.sizeBytes,
      status: result.doc.status,
    },
  });
}
