import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/providers/storage";
import { logActivity } from "./activity";
import type { DocType } from "@prisma/client";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export interface UploadInput {
  prospectId: string;
  userId: string;          // for activity log
  type: DocType;
  originalName: string;
  mime: string;
  buffer: Buffer;
}

export async function uploadDocument(input: UploadInput) {
  if (!ALLOWED_MIME.has(input.mime)) {
    return { ok: false as const, reason: "BAD_MIME" as const };
  }
  if (input.buffer.byteLength > MAX_BYTES) {
    return { ok: false as const, reason: "TOO_LARGE" as const };
  }

  const ext = pickExt(input.mime, input.originalName);
  const rand = crypto.randomBytes(8).toString("hex");
  const storageKey = `prospects/${input.prospectId}/${input.type}-${Date.now()}-${rand}${ext}`;

  const stored = await storage().put(storageKey, input.buffer, input.mime);

  const doc = await prisma.document.create({
    data: {
      prospectId: input.prospectId,
      type: input.type,
      storageKey: stored.key,
      encMeta: stored.encMeta as never,
      originalName: input.originalName,
      mime: input.mime,
      sizeBytes: stored.sizeBytes,
    },
  });

  await logActivity({
    entityType: "document",
    entityId: doc.id,
    action: "document.uploaded",
    actorId: input.userId,
    meta: { type: input.type, name: input.originalName, size: stored.sizeBytes },
  });

  return { ok: true as const, doc };
}

function pickExt(mime: string, name: string): string {
  const fromMime = mime === "application/pdf" ? ".pdf" : mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : "";
  if (fromMime) return fromMime;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
}
