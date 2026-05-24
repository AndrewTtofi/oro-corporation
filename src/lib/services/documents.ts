import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/providers/storage";
import { logActivity } from "./activity";
import type { DocPurpose, DocStatus, DocType } from "@prisma/client";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export interface UploadInput {
  prospectId: string;
  userId: string;          // for activity log
  type: DocType;
  originalName: string;
  mime: string;
  buffer: Buffer;
  serviceTypeKey?: string | null;
  fulfillsRequestId?: string | null;
  purpose?: DocPurpose;
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
      serviceTypeKey: input.serviceTypeKey ?? null,
      ...(input.purpose !== undefined && { purpose: input.purpose }),
    },
  });

  if (input.fulfillsRequestId) {
    try {
      await prisma.documentRequest.update({
        where: { id: input.fulfillsRequestId, state: "open" },
        data: {
          state: "fulfilled",
          fulfilledById: input.userId,
          fulfilledAt: new Date(),
          fulfilledDocumentId: doc.id,
        },
      });
      await logActivity({
        entityType: "doc_request", entityId: input.fulfillsRequestId,
        action: "doc_request.fulfilled", actorId: input.userId,
        meta: { documentId: doc.id },
      });
    } catch {
      // Already fulfilled or cancelled — fine, the doc still uploaded.
    }
  }

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

export async function setDocumentStatus(documentId: string, status: DocStatus, actorId: string) {
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { status },
    select: { id: true, prospectId: true },
  });
  await logActivity({
    entityType: "document", entityId: documentId,
    action: "document.status_changed", actorId,
    meta: { status },
  });
  return updated;
}

export async function deleteDocument(documentId: string, actorId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, fulfillsRequest: { select: { id: true } } },
  });
  if (!doc) throw new Error("Document not found");

  await prisma.$transaction(async (tx) => {
    if (doc.fulfillsRequest) {
      await tx.documentRequest.update({
        where: { id: doc.fulfillsRequest.id },
        data: { state: "open", fulfilledAt: null, fulfilledById: null, fulfilledDocumentId: null },
      });
    }
    await tx.document.delete({ where: { id: documentId } });
  });

  await logActivity({
    entityType: "document", entityId: documentId,
    action: "document.deleted", actorId,
  });
}
