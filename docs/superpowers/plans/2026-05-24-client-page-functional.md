# Client Detail Page Functional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every UI element on `/admin/clients/[id]` functionally complete (no dead links, no `alert()` stubs, no read-only sections that should be editable), and add messaging + document-request flows on top.

**Architecture:** Two phases. Phase 1 rewrites the client detail page in place — extends the existing `Client` model, adds `DocumentRequest`, wires up service-layer CRUD for services / key dates / documents, and replaces inline static components with editable client components. Phase 2 adds two new sub-pages (`/messages`, `/request-docs`) on top.

**Tech Stack:** Next.js 15 App Router, Prisma + Postgres, Auth.js v5, Tailwind, node-cron worker, Vitest. Same patterns as the recently-merged KYC/AML compliance subsystem.

---

## Conventions used throughout

- **TDD** for pure functions and services with deterministic inputs (e.g. folder-bucketing helpers, gate logic). UI and API routes get implemented then smoke-tested manually via `curl` + browser.
- **Commits** after each passing test or coherent UI chunk. Conventional prefixes (`feat:`, `chore:`, `fix:`).
- **All file paths absolute from repo root.**
- **Existing patterns to follow** (same as KYC plan):
  - `assertRole('staff')` from `src/lib/auth/guards.ts` for API routes.
  - `requireRole('staff')` for pages.
  - Activity logging via `logActivity({ entityType, entityId, action, actorId, meta })`.
  - Prisma client: `import { prisma } from '@/lib/db'`.
- **Commit-message rule:** use `git -c commit.gpgsign=false commit -m "..."` (signing is disabled this session). Do NOT add a Co-Authored-By line.
- **Dev hot reload:** the running web container picks up file changes via `next dev`. Schema changes require `prisma db push` inside the container + `docker compose ... restart web`.

---

## Phase 1 — Client page core

### Task 1: Extend Prisma schema (Client + Document + DocumentRequest)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Extend `Client` model**

Find `model Client { ... }` (~line 149). Add inside the field block (anywhere before the relations):

```prisma
  country              String?
  address              String?
  registrationNumber   String?
  vatNumber            String?
  taxResidency         String?
  engagementLetterDate DateTime?
```

- [ ] **Step 2: Extend `Document` model**

Find `model Document`. Add to the field block:

```prisma
  serviceTypeKey String?
```

Add to the index block (alongside existing indexes):

```prisma
  @@index([serviceTypeKey])
```

- [ ] **Step 3: Add `DocumentRequestState` enum**

Insert near the other enums (after `enum DocPurpose { ... }`):

```prisma
enum DocumentRequestState {
  open
  fulfilled
  cancelled
}
```

- [ ] **Step 4: Append `DocumentRequest` model at end of file**

```prisma
model DocumentRequest {
  id                  String    @id @default(uuid())
  clientId            String
  client              Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  description         String
  serviceTypeKey      String?
  requestedById       String
  requestedBy         User      @relation("DocRequestedBy", fields: [requestedById], references: [id])
  dueAt               DateTime?
  state               DocumentRequestState @default(open)
  fulfilledById       String?
  fulfilledAt         DateTime?
  fulfilledDocumentId String?   @unique
  fulfilledDocument   Document? @relation("DocRequestFulfilledDoc", fields: [fulfilledDocumentId], references: [id])
  createdAt           DateTime  @default(now())

  @@index([clientId, state])
}
```

- [ ] **Step 5: Add back-relations to `User`, `Client`, `Document`**

`User` model — add to relation block:
```prisma
  docRequestsMade DocumentRequest[] @relation("DocRequestedBy")
```

`Client` model — add to relation block:
```prisma
  documentRequests DocumentRequest[]
```

`Document` model — add to relation block:
```prisma
  fulfillsRequest DocumentRequest? @relation("DocRequestFulfilledDoc")
```

- [ ] **Step 6: Push schema, regenerate client, restart web**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web \
  node ./node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --accept-data-loss
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart web
npx prisma generate --schema=./prisma/schema.prisma
until curl -fsS http://localhost/api/health > /dev/null 2>&1; do sleep 1; done
echo ready
```

- [ ] **Step 7: Verify the new model is queryable**

Run:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T web node -e \
  "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.documentRequest.count().then(c=>console.log('count:',c)).finally(()=>p.\$disconnect());"
```
Expected: `count: 0`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git -c commit.gpgsign=false commit -m "feat(schema): extend Client + Document, add DocumentRequest"
```

---

### Task 2: Extend ActivityAction unions

**Files:**
- Modify: `src/lib/services/activity.ts`

- [ ] **Step 1: Add new actions and entity types**

Find the `ActivityAction` union. Add these entries (preserving existing ones):

```ts
  | "client.profile_updated"
  | "client.primary_staff_changed"
  | "client.service_updated"
  | "client.service_removed"
  | "client.key_date_updated"
  | "client.key_date_completed"
  | "client.key_date_deleted"
  | "document.deleted"
  | "message.sent"
  | "doc_request.created"
  | "doc_request.cancelled"
  | "doc_request.fulfilled"
```

Find the `entityType` parameter type in `logActivity` and extend it to also accept `"message"` and `"doc_request"`. The full union becomes:

```ts
  entityType: "prospect" | "client" | "document" | "booking" | "user"
    | "compliance_file" | "party" | "kyc_case" | "screening_run" | "review_task"
    | "message" | "doc_request";
```

- [ ] **Step 2: Type-check + test**

```bash
npm run typecheck
npm test
```

Both should pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/activity.ts
git -c commit.gpgsign=false commit -m "feat(activity): add client-page mutation actions + new entity types"
```

---

### Task 3: Folder-bucketing helper (TDD)

**Files:**
- Create: `src/lib/services/documents-bucket.ts`
- Create: `src/lib/services/__tests__/documents-bucket.test.ts`

Pure helper that maps a Document row to its folder label on the client page.

- [ ] **Step 1: Write the failing test**

`src/lib/services/__tests__/documents-bucket.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { bucketDocument, BUCKET_KYC, BUCKET_CORRESPONDENCE } from "../documents-bucket";

const d = (over: Partial<Parameters<typeof bucketDocument>[0]>) => bucketDocument({
  purpose: "other", partyId: null, serviceTypeKey: null, ...over,
});

describe("bucketDocument", () => {
  it("returns KYC when purpose is passport/POA/SOF", () => {
    expect(d({ purpose: "passport" })).toBe(BUCKET_KYC);
    expect(d({ purpose: "proof_of_address" })).toBe(BUCKET_KYC);
    expect(d({ purpose: "sof" })).toBe(BUCKET_KYC);
  });
  it("returns the service key when present and purpose is other", () => {
    expect(d({ purpose: "other", serviceTypeKey: "company_formation" })).toBe("company_formation");
  });
  it("KYC purpose wins over serviceTypeKey", () => {
    expect(d({ purpose: "passport", serviceTypeKey: "company_formation" })).toBe(BUCKET_KYC);
  });
  it("falls back to correspondence", () => {
    expect(d({ purpose: "other", serviceTypeKey: null })).toBe(BUCKET_CORRESPONDENCE);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx vitest run src/lib/services/__tests__/documents-bucket.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

`src/lib/services/documents-bucket.ts`:
```ts
import type { DocPurpose } from "@prisma/client";

export const BUCKET_KYC = "__kyc__" as const;
export const BUCKET_CORRESPONDENCE = "__correspondence__" as const;

export interface BucketInput {
  purpose: DocPurpose;
  partyId: string | null;
  serviceTypeKey: string | null;
}

/**
 * Returns the folder identifier this document should render under on the
 * client page. Returns either:
 *  - BUCKET_KYC (KYC Documents folder)
 *  - BUCKET_CORRESPONDENCE (general / un-bucketed)
 *  - a Service.key string (e.g. "company_formation")
 */
export function bucketDocument(d: BucketInput): string {
  if (d.purpose === "passport" || d.purpose === "proof_of_address" || d.purpose === "sof") {
    return BUCKET_KYC;
  }
  if (d.serviceTypeKey) return d.serviceTypeKey;
  return BUCKET_CORRESPONDENCE;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/lib/services/__tests__/documents-bucket.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/documents-bucket.ts src/lib/services/__tests__/documents-bucket.test.ts
git -c commit.gpgsign=false commit -m "feat(documents): add bucketDocument helper"
```

---

### Task 4: Extend `updateClient` service for profile fields + primary staff

**Files:**
- Modify: `src/lib/services/submissions.ts` (it owns the convert/client logic — check for an existing `updateClient` or similar)
- Possibly create: `src/lib/services/clients.ts` (if no such service exists)

- [ ] **Step 1: Locate existing client-update logic**

Run:
```bash
grep -rn "updateClient\|prisma.client.update\b" src/lib/services/ src/app/api/admin/clients/ | head -10
```

Find where the PATCH /api/admin/clients/[id] route lives and what service it calls. If no dedicated service function exists, the route is probably calling `prisma.client.update` directly. We'll move that into a service.

- [ ] **Step 2: Create the service file**

`src/lib/services/clients.ts`:
```ts
import { prisma } from "@/lib/db";
import type { ClientStatus } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface ClientProfilePatch {
  companyName?: string | null;
  country?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  taxResidency?: string | null;
  engagementLetterDate?: string | null; // ISO date
  phone?: string | null; // proxied to User
}

export async function updateClientProfile(clientId: string, patch: ClientProfilePatch, actorId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { userId: true } });
  if (!client) throw new Error("Client not found");

  const clientData: Record<string, unknown> = {};
  for (const key of ["companyName", "country", "address", "registrationNumber", "vatNumber", "taxResidency"] as const) {
    if (patch[key] !== undefined) clientData[key] = patch[key];
  }
  if (patch.engagementLetterDate !== undefined) {
    clientData.engagementLetterDate = patch.engagementLetterDate ? new Date(patch.engagementLetterDate) : null;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(clientData).length > 0) {
      await tx.client.update({ where: { id: clientId }, data: clientData });
    }
    if (patch.phone !== undefined) {
      await tx.user.update({ where: { id: client.userId }, data: { phone: patch.phone } });
    }
  });

  await logActivity({
    entityType: "client", entityId: clientId,
    action: "client.profile_updated", actorId,
    meta: { fieldsChanged: Object.keys({ ...clientData, ...(patch.phone !== undefined ? { phone: 1 } : {}) }) },
  });
}

export async function updatePrimaryStaff(clientId: string, primaryStaffId: string, actorId: string) {
  const target = await prisma.user.findUnique({ where: { id: primaryStaffId }, select: { role: true } });
  if (!target) throw new Error("Staff member not found");
  if (target.role !== "staff") throw new Error("New primary must be a staff user");

  await prisma.client.update({ where: { id: clientId }, data: { primaryStaffId } });
  await logActivity({
    entityType: "client", entityId: clientId,
    action: "client.primary_staff_changed", actorId,
    meta: { primaryStaffId },
  });
}

export async function updateClientStatus(clientId: string, status: ClientStatus, actorId: string) {
  await prisma.client.update({ where: { id: clientId }, data: { status } });
  await logActivity({
    entityType: "client", entityId: clientId,
    action: "client.status_changed", actorId,
    meta: { status },
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```

Should pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/clients.ts
git -c commit.gpgsign=false commit -m "feat(clients): add updateClientProfile + updatePrimaryStaff + updateClientStatus services"
```

---

### Task 5: Client-services CRUD service

**Files:**
- Create: `src/lib/services/client-services.ts`

- [ ] **Step 1: Implement**

`src/lib/services/client-services.ts`:
```ts
import { prisma } from "@/lib/db";
import type { SvcStatus } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface AddClientServiceInput {
  serviceType: string;
  assignedPartnerId?: string | null;
  startDate?: string | null;
  notes?: string | null;
}

export async function addClientService(clientId: string, input: AddClientServiceInput, actorId: string) {
  const created = await prisma.clientService.create({
    data: {
      clientId,
      serviceType: input.serviceType,
      assignedPartnerId: input.assignedPartnerId ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      notes: input.notes ?? null,
    },
  });
  await logActivity({
    entityType: "client", entityId: clientId,
    action: "client.service_added", actorId,
    meta: { serviceType: input.serviceType, clientServiceId: created.id },
  });
  return created;
}

export interface UpdateClientServiceInput {
  status?: SvcStatus;
  assignedPartnerId?: string | null;
  startDate?: string | null;
  notes?: string | null;
}

export async function updateClientService(serviceId: string, patch: UpdateClientServiceInput, actorId: string) {
  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.assignedPartnerId !== undefined) data.assignedPartnerId = patch.assignedPartnerId;
  if (patch.startDate !== undefined) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if (patch.notes !== undefined) data.notes = patch.notes;

  const updated = await prisma.clientService.update({ where: { id: serviceId }, data });
  await logActivity({
    entityType: "client", entityId: updated.clientId,
    action: "client.service_updated", actorId,
    meta: { clientServiceId: serviceId, ...patch },
  });
}

export async function removeClientService(serviceId: string, actorId: string) {
  const cs = await prisma.clientService.findUnique({ where: { id: serviceId }, select: { clientId: true, serviceType: true } });
  if (!cs) throw new Error("Service not found");
  await prisma.clientService.delete({ where: { id: serviceId } });
  await logActivity({
    entityType: "client", entityId: cs.clientId,
    action: "client.service_removed", actorId,
    meta: { clientServiceId: serviceId, serviceType: cs.serviceType },
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/client-services.ts
git -c commit.gpgsign=false commit -m "feat(client-services): add CRUD service"
```

---

### Task 6: Key-dates service

**Files:**
- Create: `src/lib/services/key-dates.ts`

- [ ] **Step 1: Implement**

```ts
import { prisma } from "@/lib/db";
import type { KeyDateStatus } from "@prisma/client";
import { logActivity } from "@/lib/services/activity";

export interface UpdateKeyDateInput {
  description?: string;
  dueDate?: string; // ISO date
  status?: KeyDateStatus;
}

export async function updateKeyDate(keyDateId: string, patch: UpdateKeyDateInput, actorId: string) {
  const kd = await prisma.keyDate.findUnique({ where: { id: keyDateId }, select: { clientId: true } });
  if (!kd) throw new Error("Key date not found");

  const data: Record<string, unknown> = {};
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.dueDate !== undefined) data.dueDate = new Date(patch.dueDate);
  if (patch.status !== undefined) data.status = patch.status;

  await prisma.keyDate.update({ where: { id: keyDateId }, data });

  const action = patch.status === "completed" ? "client.key_date_completed" : "client.key_date_updated";
  await logActivity({
    entityType: "client", entityId: kd.clientId,
    action, actorId,
    meta: { keyDateId, ...patch },
  });
}

export async function deleteKeyDate(keyDateId: string, actorId: string) {
  const kd = await prisma.keyDate.findUnique({ where: { id: keyDateId }, select: { clientId: true } });
  if (!kd) throw new Error("Key date not found");
  await prisma.keyDate.delete({ where: { id: keyDateId } });
  await logActivity({
    entityType: "client", entityId: kd.clientId,
    action: "client.key_date_deleted", actorId,
    meta: { keyDateId },
  });
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run typecheck
git add src/lib/services/key-dates.ts
git -c commit.gpgsign=false commit -m "feat(key-dates): add update + delete services"
```

---

### Task 7: Documents service extensions + DocumentRequest fulfillment seam

**Files:**
- Modify: `src/lib/services/documents.ts`
- Create: `src/lib/services/document-requests.ts`

- [ ] **Step 1: Add `setDocumentStatus` + `deleteDocument` to documents.ts**

Open `src/lib/services/documents.ts`. After the existing `uploadDocument` function, append:

```ts
import type { DocStatus } from "@prisma/client";

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
      // Detach the fulfillment so the request becomes open again
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
```

- [ ] **Step 2: Extend `uploadDocument` to accept `serviceTypeKey` + `fulfillsRequestId`**

Find the existing `UploadInput` interface and `uploadDocument` function. Modify:

```ts
export interface UploadInput {
  prospectId: string;
  userId: string;
  type: DocType;
  originalName: string;
  mime: string;
  buffer: Buffer;
  serviceTypeKey?: string | null;
  fulfillsRequestId?: string | null;
}
```

In the function body, when creating the Document row, add `serviceTypeKey: input.serviceTypeKey ?? null` to the data. After the Document is created, if `input.fulfillsRequestId` is set, atomically mark the DocumentRequest fulfilled:

```ts
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
```

- [ ] **Step 3: Create document-requests service**

`src/lib/services/document-requests.ts`:
```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";

export interface CreateRequestInput {
  description: string;
  serviceTypeKey?: string | null;
  dueAt?: string | null;
}

export async function createDocumentRequest(clientId: string, input: CreateRequestInput, requestedById: string) {
  const created = await prisma.documentRequest.create({
    data: {
      clientId,
      requestedById,
      description: input.description,
      serviceTypeKey: input.serviceTypeKey ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    },
  });
  await logActivity({
    entityType: "doc_request", entityId: created.id,
    action: "doc_request.created", actorId: requestedById,
    meta: { clientId, description: input.description },
  });
  return created;
}

export async function cancelDocumentRequest(requestId: string, actorId: string) {
  const req = await prisma.documentRequest.findUnique({ where: { id: requestId }, select: { state: true, clientId: true } });
  if (!req) throw new Error("Request not found");
  if (req.state === "fulfilled") throw new Error("Cannot cancel a fulfilled request");
  await prisma.documentRequest.update({ where: { id: requestId }, data: { state: "cancelled" } });
  await logActivity({
    entityType: "doc_request", entityId: requestId,
    action: "doc_request.cancelled", actorId,
    meta: { clientId: req.clientId },
  });
}
```

- [ ] **Step 4: Type-check + test**

```bash
npm run typecheck
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/documents.ts src/lib/services/document-requests.ts
git -c commit.gpgsign=false commit -m "feat(documents): add status/delete services + DocumentRequest fulfillment seam"
```

---

### Task 8: Extend PATCH `/api/admin/clients/[id]` for profile fields

**Files:**
- Modify: `src/app/api/admin/clients/[id]/route.ts`

- [ ] **Step 1: Read the current file**

```bash
cat src/app/api/admin/clients/\[id\]/route.ts
```

- [ ] **Step 2: Rewrite to use the new service + accept profile fields**

Replace contents with:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateClientProfile, updatePrimaryStaff, updateClientStatus } from "@/lib/services/clients";
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

  try {
    if (body.data.status !== undefined) {
      await updateClientStatus(id, body.data.status as ClientStatus, me.id);
    }
    if (body.data.primaryStaffId !== undefined) {
      await updatePrimaryStaff(id, body.data.primaryStaffId, me.id);
    }
    // Strip status + primaryStaffId before passing profile fields
    const { status: _status, primaryStaffId: _ps, ...profile } = body.data;
    if (Object.keys(profile).length > 0) {
      await updateClientProfile(id, profile, me.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Smoke + commit**

```bash
curl -s -o /dev/null -w "PATCH %{http_code}\n" -X PATCH http://localhost/api/admin/clients/test-id -H "Content-Type: application/json" -d '{"status":"active"}'
# Expect 401/307/500-from-assertRole-throw (NOT connection refused)
git add 'src/app/api/admin/clients/[id]/route.ts'
git -c commit.gpgsign=false commit -m "feat(api): client PATCH accepts profile fields + primary staff"
```

---

### Task 9: Client-services API routes

**Files:**
- Create: `src/app/api/admin/clients/[id]/services/route.ts` (POST)
- Create: `src/app/api/admin/clients/[id]/services/[serviceId]/route.ts` (PATCH, DELETE)

- [ ] **Step 1: POST endpoint**

`src/app/api/admin/clients/[id]/services/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { addClientService } from "@/lib/services/client-services";

export const runtime = "nodejs";

const schema = z.object({
  serviceType: z.string().min(1).max(60),
  assignedPartnerId: z.string().uuid().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const cs = await addClientService(id, body.data, me.id);
  return NextResponse.json({ ok: true, id: cs.id });
}
```

- [ ] **Step 2: PATCH + DELETE endpoint**

`src/app/api/admin/clients/[id]/services/[serviceId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateClientService, removeClientService } from "@/lib/services/client-services";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  assignedPartnerId: z.string().uuid().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const me = await assertRole("staff");
  const { serviceId } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  await updateClientService(serviceId, body.data, me.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const me = await assertRole("staff");
  const { serviceId } = await params;
  try {
    await removeClientService(serviceId, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Smoke + commit**

```bash
for p in /api/admin/clients/x/services /api/admin/clients/x/services/y; do
  printf "%-55s -> HTTP " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost$p"
done
git add 'src/app/api/admin/clients/[id]/services'
git -c commit.gpgsign=false commit -m "feat(api): client services POST/PATCH/DELETE"
```

---

### Task 10: Key-dates PATCH + DELETE routes

**Files:**
- Create: `src/app/api/admin/clients/[id]/key-dates/[keyDateId]/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { updateKeyDate, deleteKeyDate } from "@/lib/services/key-dates";

export const runtime = "nodejs";

const patchSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  dueDate: z.string().date().optional(),
  status: z.enum(["upcoming", "overdue", "completed"]).optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; keyDateId: string }> }) {
  const me = await assertRole("staff");
  const { keyDateId } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  await updateKeyDate(keyDateId, body.data, me.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; keyDateId: string }> }) {
  const me = await assertRole("staff");
  const { keyDateId } = await params;
  await deleteKeyDate(keyDateId, me.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Smoke + commit**

```bash
printf "PATCH key-date  -> HTTP "
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost/api/admin/clients/x/key-dates/y"
git add 'src/app/api/admin/clients/[id]/key-dates/[keyDateId]'
git -c commit.gpgsign=false commit -m "feat(api): key-date PATCH/DELETE"
```

---

### Task 11: Documents API — staff upload + status + delete

**Files:**
- Create: `src/app/api/admin/clients/[id]/documents/route.ts` (POST)
- Create: `src/app/api/admin/documents/[id]/route.ts` (PATCH, DELETE)

- [ ] **Step 1: Staff upload endpoint**

`src/app/api/admin/clients/[id]/documents/route.ts`:
```ts
import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { uploadDocument, MAX_BYTES } from "@/lib/services/documents";
import type { DocType } from "@prisma/client";

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
  const type = typeMap[purposeRaw];
  if (!type || !ALLOWED.includes(type)) return NextResponse.json({ error: "Invalid purpose" }, { status: 422 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadDocument({
    prospectId: client.prospectId,
    userId: me.id,
    type,
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    buffer,
    serviceTypeKey,
    fulfillsRequestId,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json({ ok: true, documentId: result.doc.id });
}
```

- [ ] **Step 2: PATCH + DELETE document endpoint**

`src/app/api/admin/documents/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { setDocumentStatus, deleteDocument } from "@/lib/services/documents";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["received", "under_review", "approved", "reupload_needed"]).optional(),
  serviceTypeKey: z.string().max(60).nullable().optional(),
}).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  if (body.data.status !== undefined) {
    await setDocumentStatus(id, body.data.status, me.id);
  }
  if (body.data.serviceTypeKey !== undefined) {
    await prisma.document.update({ where: { id }, data: { serviceTypeKey: body.data.serviceTypeKey } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  await deleteDocument(id, me.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Smoke + commit**

```bash
for p in /api/admin/clients/x/documents /api/admin/documents/x; do
  printf "%-55s -> HTTP " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost$p"
done
git add 'src/app/api/admin/clients/[id]/documents' 'src/app/api/admin/documents'
git -c commit.gpgsign=false commit -m "feat(api): staff document upload + status + delete"
```

---

### Task 12: `EditableClientHeader` component

**Files:**
- Create: `src/app/admin/clients/[id]/EditableClientHeader.tsx`

- [ ] **Step 1: Implement**

`src/app/admin/clients/[id]/EditableClientHeader.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  companyName: string | null;
  country: string | null;
  address: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  taxResidency: string | null;
  engagementLetterDate: string | null; // ISO
  phone: string | null;
};

export function EditableClientHeader({
  clientId, initials, name, reference, since, email, initial,
}: {
  clientId: string;
  initials: string;
  name: string;
  reference: string;
  since: string; // ISO
  email: string;
  initial: Profile;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Profile>(initial);
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: draft.companyName,
          country: draft.country,
          address: draft.address,
          registrationNumber: draft.registrationNumber,
          vatNumber: draft.vatNumber,
          taxResidency: draft.taxResidency,
          engagementLetterDate: draft.engagementLetterDate,
          phone: draft.phone,
        }),
      });
      if (res.ok) { setEditing(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Save failed"); }
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 items-start">
          <div className="w-14 h-14 rounded-full grid place-items-center text-meta font-bold bg-accent text-dark">{initials}</div>
          <div>
            <h1 className="font-display text-2xl">{name}</h1>
            <p className="text-meta text-admin-muted">
              {draft.companyName ?? "—"} · Ref {reference} · Client since {new Date(since).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-meta text-admin-muted mt-1">
              <a href={`mailto:${email}`} className="underline">{email}</a> · {draft.phone ?? "—"}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing((v) => !v)} className="btn px-3 py-1.5 text-meta">
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Field label="Company name"><input value={draft.companyName ?? ""} onChange={(e) => setDraft({ ...draft, companyName: e.target.value || null })} className="input" /></Field>
          <Field label="Phone"><input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value || null })} className="input" /></Field>
          <Field label="Country (ISO, e.g. CY)"><input maxLength={2} value={draft.country ?? ""} onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() || null })} className="input" /></Field>
          <Field label="Tax residency (ISO)"><input maxLength={2} value={draft.taxResidency ?? ""} onChange={(e) => setDraft({ ...draft, taxResidency: e.target.value.toUpperCase() || null })} className="input" /></Field>
          <Field label="Registered address" className="md:col-span-2"><textarea value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value || null })} rows={2} className="input" /></Field>
          <Field label="Cyprus HE number"><input value={draft.registrationNumber ?? ""} onChange={(e) => setDraft({ ...draft, registrationNumber: e.target.value || null })} className="input" /></Field>
          <Field label="VAT number"><input value={draft.vatNumber ?? ""} onChange={(e) => setDraft({ ...draft, vatNumber: e.target.value || null })} className="input" /></Field>
          <Field label="Engagement letter date"><input type="date" value={draft.engagementLetterDate?.slice(0, 10) ?? ""} onChange={(e) => setDraft({ ...draft, engagementLetterDate: e.target.value || null })} className="input" /></Field>
          <div className="md:col-span-2 flex gap-2 justify-end mt-2">
            <button type="button" onClick={() => { setDraft(initial); setEditing(false); }} className="btn px-4 py-2">Cancel</button>
            <button type="button" onClick={save} disabled={pending} className="btn btn-primary px-4 py-2 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="mt-6 grid gap-2 md:grid-cols-3 text-meta">
          <Pair label="Country" value={draft.country} />
          <Pair label="Tax residency" value={draft.taxResidency} />
          <Pair label="HE number" value={draft.registrationNumber} />
          <Pair label="VAT number" value={draft.vatNumber} />
          <Pair label="Engagement letter" value={draft.engagementLetterDate ? new Date(draft.engagementLetterDate).toLocaleDateString("en-GB") : null} />
          <Pair label="Address" value={draft.address} className="md:col-span-3" />
        </div>
      )}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] uppercase tracking-widest text-admin-muted font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Pair({ label, value, className = "" }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-widest text-admin-muted">{label}</div>
      <div className="font-mono">{value ?? "—"}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'src/app/admin/clients/[id]/EditableClientHeader.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): EditableClientHeader (inline edit for profile fields)"
```

---

### Task 13: `ComplianceBar` component

**Files:**
- Create: `src/app/admin/clients/[id]/ComplianceBar.tsx`

- [ ] **Step 1: Implement**

`src/app/admin/clients/[id]/ComplianceBar.tsx`:
```tsx
import Link from "next/link";

export function ComplianceBar({ clientId, status, riskRating }: {
  clientId: string;
  status: "open" | "in_review" | "cleared" | "blocked" | null;
  riskRating: "low" | "standard" | "high" | null;
}) {
  if (!status) return null;
  const cls = status === "cleared" ? "badge-approved" : status === "blocked" ? "badge-pending" : "badge-pending";
  const riskColor = riskRating === "high" ? "#DC2626" : riskRating === "low" ? "#16A34A" : "#CA8A04";

  return (
    <section className="mb-6 flex items-center justify-between bg-admin-bg border border-admin-border rounded-card px-4 py-3">
      <div className="flex items-center gap-3 text-meta">
        <span className="font-semibold uppercase tracking-widest text-[11px] text-admin-muted">Compliance</span>
        <span className={`badge ${cls} capitalize`}>{status.replace("_", " ")}</span>
        {riskRating && (
          <span className="text-meta">
            risk: <span className="font-semibold capitalize" style={{ color: riskColor }}>{riskRating}</span>
          </span>
        )}
      </div>
      <Link href={`/admin/clients/${clientId}/compliance`} className="text-meta underline">
        Open compliance file →
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'src/app/admin/clients/[id]/ComplianceBar.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): ComplianceBar (status + risk + link to /compliance)"
```

---

### Task 14: Services Engaged components

**Files:**
- Create: `src/app/admin/clients/[id]/ServicesEngagedList.tsx`
- Create: `src/app/admin/clients/[id]/ServiceRowClient.tsx`
- Create: `src/app/admin/clients/[id]/AddServiceModal.tsx`

- [ ] **Step 1: `ServicesEngagedList` (server)**

```tsx
import { ServiceRowClient } from "./ServiceRowClient";
import { AddServiceModal } from "./AddServiceModal";

export type ServiceRow = {
  id: string;
  serviceType: string;
  status: "pending" | "in_progress" | "completed";
  assignedPartnerId: string | null;
  startDate: string | null;
  notes: string | null;
};

export function ServicesEngagedList({
  clientId, rows, partners, taxonomy,
}: {
  clientId: string;
  rows: ServiceRow[];
  partners: { id: string; fullName: string }[];
  taxonomy: { key: string; label: string }[];
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted">Services Engaged</h2>
        <AddServiceModal clientId={clientId} taxonomy={taxonomy} partners={partners} />
      </div>
      {rows.length === 0
        ? <p className="text-meta text-admin-muted">No services yet.</p>
        : rows.map((r) => (
            <ServiceRowClient
              key={r.id}
              row={r}
              partners={partners}
              taxonomy={taxonomy}
            />
          ))}
    </section>
  );
}
```

- [ ] **Step 2: `ServiceRowClient` (client, inline edit)**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServiceRow } from "./ServicesEngagedList";

export function ServiceRowClient({ row, partners, taxonomy }: {
  row: ServiceRow;
  partners: { id: string; fullName: string }[];
  taxonomy: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(row);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row);
  const label = taxonomy.find((t) => t.key === row.serviceType)?.label ?? row.serviceType;

  function save() {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${(row as ServiceRow & { clientId?: string }).clientId ?? ""}/services/${row.id}`.replace(/\/\//, "/"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          assignedPartnerId: draft.assignedPartnerId,
          startDate: draft.startDate,
          notes: draft.notes,
        }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Save failed"); }
    });
  }
  function remove() {
    if (!confirm(`Remove ${label} from this client?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/clients/x/services/${row.id}`.replace("x", ""), { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="border border-admin-border rounded-elem p-4 mb-3 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
      <div>
        <div className="font-semibold">{label}</div>
        <input value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} placeholder="Notes" className="input mt-2 w-full" />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-admin-muted">Status</span>
        <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ServiceRow["status"] })} className="input">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-widest text-admin-muted">Partner</span>
        <select value={draft.assignedPartnerId ?? ""} onChange={(e) => setDraft({ ...draft, assignedPartnerId: e.target.value || null })} className="input">
          <option value="">Unassigned</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
      </label>
      <div className="flex gap-2 items-end">
        {dirty && <button type="button" onClick={save} disabled={pending} className="btn btn-primary px-3 py-1.5 text-meta">Save</button>}
        <button type="button" onClick={remove} disabled={pending} className="btn px-3 py-1.5 text-meta text-[#DC2626]">Remove</button>
      </div>
    </div>
  );
}
```

NOTE: the row needs `clientId` to PATCH. Fix the type — change `ServiceRow` to include `clientId`, and have `ServicesEngagedList` populate it from props.

Update `ServicesEngagedList.tsx` type to include `clientId` per row. Update the consumer in `page.tsx` (Task 18) to pass `clientId` in each row.

In `ServiceRowClient`, replace the `fetch(...)` URL with the cleaner:
```ts
const res = await fetch(`/api/admin/clients/${row.clientId}/services/${row.id}`, { method: "PATCH", ... });
```

(And ServiceRow type adds `clientId: string`.)

- [ ] **Step 3: `AddServiceModal`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddServiceModal({ clientId, taxonomy, partners }: {
  clientId: string;
  taxonomy: { key: string; label: string }[];
  partners: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: fd.get("serviceType"),
          assignedPartnerId: fd.get("assignedPartnerId") || null,
          startDate: fd.get("startDate") || null,
          notes: fd.get("notes") || null,
        }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-primary px-3 py-1.5 text-meta">+ Add service</button>;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
    >
      <div className="bg-admin-surface p-6 rounded-card w-[480px] max-w-[90vw] flex flex-col gap-3">
        <h3 className="font-display text-xl">Add service</h3>
        <select name="serviceType" required className="input">
          {taxonomy.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select name="assignedPartnerId" defaultValue="" className="input">
          <option value="">Unassigned</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
        <input name="startDate" type="date" className="input" />
        <textarea name="notes" rows={2} placeholder="Notes (optional)" className="input" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setOpen(false)} className="btn px-4 py-2">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary px-4 py-2">Add</button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/admin/clients/[id]/ServicesEngagedList.tsx' 'src/app/admin/clients/[id]/ServiceRowClient.tsx' 'src/app/admin/clients/[id]/AddServiceModal.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): ServicesEngagedList + inline edit + AddServiceModal"
```

---

### Task 15: Key Dates components

**Files:**
- Create: `src/app/admin/clients/[id]/KeyDatesSection.tsx`
- Create: `src/app/admin/clients/[id]/KeyDateRowClient.tsx`

- [ ] **Step 1: `KeyDatesSection` (client, holds filter state)**

```tsx
"use client";
import { useState } from "react";
import { KeyDateRowClient } from "./KeyDateRowClient";

export type KeyDate = {
  id: string;
  clientId: string;
  description: string;
  dueDate: string; // ISO
  status: "upcoming" | "overdue" | "completed";
};

export function KeyDatesSection({ clientId, rows }: { clientId: string; rows: KeyDate[] }) {
  const [hideCompleted, setHideCompleted] = useState(true);
  const visible = hideCompleted ? rows.filter((r) => r.status !== "completed") : rows;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted">Key Dates &amp; Reminders</h2>
        <label className="flex items-center gap-2 text-meta">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} /> Hide completed
        </label>
      </div>
      <div className="bg-admin-surface border border-admin-border rounded-card p-6">
        <div className="flex flex-col gap-4">
          {visible.length === 0 && <p className="text-meta text-admin-muted">No key dates.</p>}
          {visible.map((kd) => <KeyDateRowClient key={kd.id} kd={kd} />)}
        </div>
        <form
          action={`/api/admin/clients/${clientId}/key-dates`}
          method="POST"
          className="mt-6 grid gap-2 grid-cols-[1fr_auto_auto]"
        >
          <input name="description" placeholder="Description (e.g. Annual return)" className="input" required />
          <input name="dueDate" type="date" className="input" required />
          <button type="submit" className="btn btn-primary px-4 py-2 text-meta">+ Add</button>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `KeyDateRowClient` (client)**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KeyDate } from "./KeyDatesSection";

export function KeyDateRowClient({ kd }: { kd: KeyDate }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ description: kd.description, dueDate: kd.dueDate.slice(0, 10) });

  function patch(body: Record<string, unknown>) {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${kd.clientId}/key-dates/${kd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setEditing(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }
  function remove() {
    if (!confirm(`Delete "${kd.description}"?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/clients/${kd.clientId}/key-dates/${kd.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  const upcoming = kd.status === "upcoming";
  const overdue = kd.status === "overdue";
  const done = kd.status === "completed";

  return (
    <div className="flex gap-4 items-start">
      <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: overdue ? "#DC2626" : upcoming ? "var(--accent)" : "var(--border)" }} />
      <div className="flex-1">
        {editing ? (
          <div className="grid gap-2 grid-cols-[1fr_auto_auto]">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input" />
            <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} className="input" />
            <button type="button" onClick={() => patch({ description: draft.description, dueDate: draft.dueDate })} disabled={pending} className="btn btn-primary px-3 py-1.5 text-meta">Save</button>
          </div>
        ) : (
          <>
            <div className="font-mono text-[12px] text-accent font-semibold">
              {new Date(kd.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
            </div>
            <div className={`font-semibold ${overdue ? "text-[#DC2626]" : done ? "line-through opacity-60" : ""}`}>{kd.description}</div>
            <div className="text-[12px] text-admin-muted">{overdue ? "Overdue" : upcoming ? "Upcoming" : "Completed"}</div>
          </>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {!done && <button type="button" disabled={pending} onClick={() => patch({ status: "completed" })} className="text-[12px] underline">Mark done</button>}
        {!editing && <button type="button" disabled={pending} onClick={() => setEditing(true)} className="text-[12px] underline">Edit</button>}
        <button type="button" disabled={pending} onClick={remove} className="text-[12px] underline text-[#DC2626]">Delete</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/clients/[id]/KeyDatesSection.tsx' 'src/app/admin/clients/[id]/KeyDateRowClient.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): KeyDatesSection + KeyDateRowClient (edit/complete/delete/filter)"
```

---

### Task 16: Documents components

**Files:**
- Create: `src/app/admin/clients/[id]/DocumentsSection.tsx`
- Create: `src/app/admin/clients/[id]/FolderSection.tsx`
- Create: `src/app/admin/clients/[id]/DocumentRow.tsx`
- Create: `src/app/admin/clients/[id]/UploadButton.tsx`

- [ ] **Step 1: `DocumentsSection` (server) — builds folder map**

```tsx
import Link from "next/link";
import { bucketDocument, BUCKET_KYC, BUCKET_CORRESPONDENCE } from "@/lib/services/documents-bucket";
import { FolderSection } from "./FolderSection";

export type DocRow = {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  status: "received" | "under_review" | "approved" | "reupload_needed";
  uploadedAt: string;
  serviceTypeKey: string | null;
  purpose: "passport" | "proof_of_address" | "sof" | "other";
  partyId: string | null;
};

export type DocRequestRow = {
  id: string;
  description: string;
  serviceTypeKey: string | null;
  dueAt: string | null;
  state: "open" | "fulfilled" | "cancelled";
};

export function DocumentsSection({
  clientId, documents, requests, services, taxonomy,
}: {
  clientId: string;
  documents: DocRow[];
  requests: DocRequestRow[];
  services: { serviceType: string }[];
  taxonomy: { key: string; label: string }[];
}) {
  // Build folder list: KYC, then one per service in service-engaged order, then Correspondence
  const labelFor = (key: string) => {
    if (key === BUCKET_KYC) return "KYC Documents";
    if (key === BUCKET_CORRESPONDENCE) return "Correspondence";
    return taxonomy.find((t) => t.key === key)?.label ?? key;
  };

  const folderKeys = [
    BUCKET_KYC,
    ...services.map((s) => s.serviceType),
    BUCKET_CORRESPONDENCE,
  ];

  const docsByFolder = new Map<string, DocRow[]>();
  for (const d of documents) {
    const key = bucketDocument({ purpose: d.purpose, partyId: d.partyId, serviceTypeKey: d.serviceTypeKey });
    if (!docsByFolder.has(key)) docsByFolder.set(key, []);
    docsByFolder.get(key)!.push(d);
  }

  const reqsByFolder = new Map<string, DocRequestRow[]>();
  for (const r of requests) {
    if (r.state !== "open") continue;
    const key = r.serviceTypeKey ?? BUCKET_CORRESPONDENCE;
    if (!reqsByFolder.has(key)) reqsByFolder.set(key, []);
    reqsByFolder.get(key)!.push(r);
  }

  return (
    <section className="mb-8">
      <h2 className="text-meta font-bold uppercase tracking-widest text-admin-muted mb-3">Documents</h2>

      {/* Quick-jump grid */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {folderKeys.map((key) => {
          const label = labelFor(key);
          const slug = slugify(label);
          const count = (docsByFolder.get(key) ?? []).length;
          return (
            <Link key={key} href={`#docs-${slug}`} className="bg-admin-surface border border-admin-border rounded-elem p-4 text-center hover:border-accent transition-colors">
              <div className="text-meta font-medium">{label}</div>
              <div className="text-[11px] text-admin-muted">{count} {count === 1 ? "file" : "files"}</div>
            </Link>
          );
        })}
      </div>

      {/* Per-folder sections */}
      {folderKeys.map((key) => (
        <FolderSection
          key={key}
          id={`docs-${slugify(labelFor(key))}`}
          clientId={clientId}
          folderKey={key}
          label={labelFor(key)}
          documents={docsByFolder.get(key) ?? []}
          openRequests={reqsByFolder.get(key) ?? []}
        />
      ))}
    </section>
  );
}

function slugify(s: string) {
  return s.replace(/\s+/g, "-").toLowerCase();
}
```

- [ ] **Step 2: `FolderSection` (server)**

```tsx
import { DocumentRow } from "./DocumentRow";
import { UploadButton } from "./UploadButton";
import { BUCKET_KYC, BUCKET_CORRESPONDENCE } from "@/lib/services/documents-bucket";
import type { DocRow, DocRequestRow } from "./DocumentsSection";

export function FolderSection({
  id, clientId, folderKey, label, documents, openRequests,
}: {
  id: string;
  clientId: string;
  folderKey: string;
  label: string;
  documents: DocRow[];
  openRequests: DocRequestRow[];
}) {
  const isKyc = folderKey === BUCKET_KYC;
  const isCorrespondence = folderKey === BUCKET_CORRESPONDENCE;
  const serviceTypeKey = isKyc || isCorrespondence ? null : folderKey;
  const defaultPurpose = isKyc ? "passport" : "other";

  return (
    <section id={id} className="bg-admin-surface border border-admin-border rounded-card p-6 mb-4 scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">{label} <span className="text-meta text-admin-muted font-normal">({documents.length})</span></h3>
        <UploadButton clientId={clientId} serviceTypeKey={serviceTypeKey} defaultPurpose={defaultPurpose} />
      </div>

      {documents.length === 0 ? <p className="text-meta text-admin-muted">No documents yet.</p> : (
        <table className="w-full">
          <thead>
            <tr style={{ background: "#FDFDFD" }}>
              <Th>Name</Th><Th>Type</Th><Th>Size</Th><Th>Uploaded</Th><Th>Status</Th><Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => <DocumentRow key={d.id} doc={d} />)}
          </tbody>
        </table>
      )}

      {openRequests.length > 0 && (
        <div className="mt-4 border-t border-admin-border pt-4">
          <div className="text-[11px] uppercase tracking-widest text-admin-muted font-semibold mb-2">Open requests</div>
          <ul className="flex flex-col gap-2">
            {openRequests.map((r) => (
              <li key={r.id} className="flex justify-between items-center text-meta">
                <span>
                  {r.description}
                  {r.dueAt && <span className="ml-2 font-mono text-[12px] text-admin-muted">due {new Date(r.dueAt).toLocaleDateString()}</span>}
                </span>
                <CancelRequestButton id={r.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left p-2 text-[11px] uppercase tracking-widest text-admin-muted font-semibold">{children}</th>;
}

function CancelRequestButton({ id }: { id: string }) {
  return <CancelRequestClient id={id} />;
}

import { CancelRequestClient } from "./CancelRequestClient";
```

- [ ] **Step 3: `CancelRequestClient` (client)**

`src/app/admin/clients/[id]/CancelRequestClient.tsx`:
```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function CancelRequestClient({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function cancel() {
    if (!confirm("Cancel this request?")) return;
    start(async () => {
      const res = await fetch(`/api/admin/document-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "cancelled" }),
      });
      if (res.ok) router.refresh();
    });
  }
  return <button type="button" onClick={cancel} disabled={pending} className="text-[12px] underline">Cancel</button>;
}
```

- [ ] **Step 4: `DocumentRow` (client)**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocRow } from "./DocumentsSection";

export function DocumentRow({ doc }: { doc: DocRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function setStatus(status: DocRow["status"]) {
    start(async () => {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    });
  }
  function remove() {
    if (!confirm(`Delete ${doc.originalName}?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <tr className="border-t border-admin-border">
        <td className="p-2"><button type="button" onClick={() => setOpen((v) => !v)} className="underline text-meta">{doc.originalName}</button></td>
        <td className="p-2 text-meta">{doc.mime}</td>
        <td className="p-2 font-mono text-meta">{(doc.sizeBytes / 1024).toFixed(0)} KB</td>
        <td className="p-2 font-mono text-meta">{new Date(doc.uploadedAt).toLocaleDateString("en-GB")}</td>
        <td className="p-2">
          <select value={doc.status} onChange={(e) => setStatus(e.target.value as DocRow["status"])} disabled={pending} className="input py-1 px-2 text-meta">
            <option value="received">Received</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="reupload_needed">Re-upload needed</option>
          </select>
        </td>
        <td className="p-2"><button type="button" onClick={remove} disabled={pending} className="text-[12px] underline text-[#DC2626]">Delete</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="p-2">
            <iframe src={`/app/documents/${doc.id}`} className="w-full h-[480px] bg-admin-bg border border-admin-border rounded-elem" />
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 5: `UploadButton` (client)**

```tsx
"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocPurpose } from "@prisma/client";

export function UploadButton({ clientId, serviceTypeKey, defaultPurpose }: {
  clientId: string;
  serviceTypeKey: string | null;
  defaultPurpose: DocPurpose;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    start(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", defaultPurpose);
      if (serviceTypeKey) fd.append("serviceTypeKey", serviceTypeKey);
      const res = await fetch(`/api/admin/clients/${clientId}/documents`, { method: "POST", body: fd });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Upload failed"); }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={onChange} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="btn btn-primary px-3 py-1.5 text-meta disabled:opacity-50">
        {pending ? "Uploading…" : "Upload"}
      </button>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/admin/clients/[id]/DocumentsSection.tsx' 'src/app/admin/clients/[id]/FolderSection.tsx' 'src/app/admin/clients/[id]/DocumentRow.tsx' 'src/app/admin/clients/[id]/UploadButton.tsx' 'src/app/admin/clients/[id]/CancelRequestClient.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): per-folder Documents UI + DocumentRow + UploadButton"
```

---

### Task 17: ReassignModal + ClientStatusPanel update

**Files:**
- Create: `src/app/admin/clients/[id]/ReassignModal.tsx`
- Modify: `src/app/admin/clients/[id]/ClientStatusPanel.tsx`

- [ ] **Step 1: `ReassignModal`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReassignModal({ clientId, currentPrimaryId, staff }: {
  clientId: string;
  currentPrimaryId: string;
  staff: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [pick, setPick] = useState(currentPrimaryId);
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryStaffId: pick }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-meta underline text-[12px]">Reassign primary staff</button>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="bg-admin-surface p-6 rounded-card w-[400px] max-w-[90vw] flex flex-col gap-3">
        <h3 className="font-display text-xl">Reassign primary staff</h3>
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="input">
          {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <p className="text-[12px] text-admin-muted">To change assigned partners per service, edit them inline in the Services Engaged section.</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setOpen(false)} className="btn px-4 py-2">Cancel</button>
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary px-4 py-2">Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ClientStatusPanel to use ReassignModal**

Open `src/app/admin/clients/[id]/ClientStatusPanel.tsx`. Replace the placeholder button section (the `<details>` with `Reassign / Manage Team` summary and the `alert()` `onClick`) with:

```tsx
      <div className="mt-3">
        <ReassignModal clientId={clientId} currentPrimaryId={primaryStaff.id} staff={[primaryStaff, ...partners.filter((p) => p.id !== primaryStaff.id).map((p) => ({ id: p.id, fullName: p.fullName }))].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)} />
      </div>
```

NOTE: `staff` should actually be just the staff list, not partners. Adjust ClientStatusPanel's props to accept `staff: { id: string; fullName: string }[]` (passed from page.tsx) and pass that to ReassignModal directly.

Also add `import { ReassignModal } from "./ReassignModal";` at the top.

Remove the now-unused `partners` mapping for the placeholder buttons. (Keep `partners` prop if used elsewhere; otherwise drop it.)

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/clients/[id]/ReassignModal.tsx' 'src/app/admin/clients/[id]/ClientStatusPanel.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): ReassignModal replaces alert() in ClientStatusPanel"
```

---

### Task 18: Rewire `page.tsx` to use the new components

**Files:**
- Modify: `src/app/admin/clients/[id]/page.tsx`

- [ ] **Step 1: Replace contents**

Read the current `page.tsx` first to understand existing imports/structure, then replace with:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { Role } from "@prisma/client";
import { AdminClientShell } from "./AdminClientShell";
import { EditableClientHeader } from "./EditableClientHeader";
import { ComplianceBar } from "./ComplianceBar";
import { ServicesEngagedList } from "./ServicesEngagedList";
import { KeyDatesSection } from "./KeyDatesSection";
import { DocumentsSection } from "./DocumentsSection";
import { ClientStatusPanel } from "./ClientStatusPanel";
import { ClientNotes } from "./ClientNotes";
import { ClientActivity } from "./ClientActivity";
import { QuickActions } from "./QuickActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client profile" };

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      user: true,
      primaryStaff: true,
      services: { include: { assignedPartner: true } },
      keyDates: { orderBy: { dueDate: "asc" } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      prospect: { include: { documents: true } },
      complianceFile: { select: { status: true, riskRating: true } },
      documentRequests: true,
    },
  });
  if (!client) notFound();

  const activity = await prisma.activityLog.findMany({
    where: { OR: [{ entityType: "client", entityId: client.id }, { entityType: "prospect", entityId: client.prospectId }] },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { actor: true },
  });

  const partners = await prisma.user.findMany({ where: { role: Role.partner, deactivatedAt: null }, select: { id: true, fullName: true } });
  const staff    = await prisma.user.findMany({ where: { role: Role.staff,   deactivatedAt: null }, select: { id: true, fullName: true } });
  const taxonomy = await prisma.service.findMany({ where: { active: true }, select: { key: true, label: true }, orderBy: { sortOrder: "asc" } });

  const initials = client.user.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AdminClientShell breadcrumb={client.user.fullName}>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px] items-start max-w-[1200px]">
        <div>
          <EditableClientHeader
            clientId={client.id}
            initials={initials}
            name={client.user.fullName}
            reference={client.prospect.referenceNumber}
            since={client.createdAt.toISOString()}
            email={client.user.email}
            initial={{
              companyName: client.companyName,
              country: client.country,
              address: client.address,
              registrationNumber: client.registrationNumber,
              vatNumber: client.vatNumber,
              taxResidency: client.taxResidency,
              engagementLetterDate: client.engagementLetterDate?.toISOString() ?? null,
              phone: client.user.phone,
            }}
          />

          <ComplianceBar clientId={client.id} status={client.complianceFile?.status ?? null} riskRating={client.complianceFile?.riskRating ?? null} />

          <ServicesEngagedList
            clientId={client.id}
            rows={client.services.map((s) => ({
              id: s.id,
              clientId: client.id,
              serviceType: s.serviceType,
              status: s.status,
              assignedPartnerId: s.assignedPartnerId,
              startDate: s.startDate?.toISOString() ?? null,
              notes: s.notes,
            }))}
            partners={partners}
            taxonomy={taxonomy}
          />

          <KeyDatesSection
            clientId={client.id}
            rows={client.keyDates.map((kd) => ({
              id: kd.id,
              clientId: client.id,
              description: kd.description,
              dueDate: kd.dueDate.toISOString(),
              status: kd.status,
            }))}
          />

          <DocumentsSection
            clientId={client.id}
            services={client.services.map((s) => ({ serviceType: s.serviceType }))}
            taxonomy={taxonomy}
            documents={client.prospect.documents.map((d) => ({
              id: d.id,
              originalName: d.originalName,
              mime: d.mime,
              sizeBytes: d.sizeBytes,
              status: d.status,
              uploadedAt: d.uploadedAt.toISOString(),
              serviceTypeKey: d.serviceTypeKey,
              purpose: d.purpose,
              partyId: d.partyId,
            }))}
            requests={client.documentRequests.map((r) => ({
              id: r.id,
              description: r.description,
              serviceTypeKey: r.serviceTypeKey,
              dueAt: r.dueAt?.toISOString() ?? null,
              state: r.state,
            }))}
          />
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <ClientStatusPanel
            clientId={client.id}
            status={client.status}
            primaryStaff={{ id: client.primaryStaff.id, fullName: client.primaryStaff.fullName }}
            staff={staff}
          />
          <ClientNotes
            clientId={client.id}
            initial={client.internalNotes.map((n) => ({
              id: n.id,
              author: n.author.fullName,
              body: n.body,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
          <ClientActivity
            entries={activity.map((a) => ({
              id: a.id,
              action: a.action,
              actor: a.actor?.fullName ?? "System",
              createdAt: a.createdAt.toISOString(),
            }))}
          />
          <QuickActions clientId={client.id} />
        </div>
      </div>
    </AdminClientShell>
  );
}
```

- [ ] **Step 2: Create `QuickActions` component**

`src/app/admin/clients/[id]/QuickActions.tsx`:
```tsx
"use client";
import Link from "next/link";

export function QuickActions({ clientId }: { clientId: string }) {
  function scrollToKeyDates() {
    const el = document.querySelector('input[name="description"]') as HTMLInputElement | null;
    if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }
  return (
    <div>
      <div className="text-[12px] font-bold uppercase text-admin-muted tracking-widest mb-3">Quick Actions</div>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/admin/clients/${clientId}/messages`} className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center hover:border-accent hover:text-accent">Send Message</Link>
        <Link href={`/admin/clients/${clientId}/request-docs`} className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center hover:border-accent hover:text-accent">Request Docs</Link>
        <a href="#services" className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center hover:border-accent hover:text-accent">Add Service ↑</a>
        <button type="button" onClick={scrollToKeyDates} className="p-2 bg-admin-surface border border-admin-border rounded-inner text-[12px] font-semibold text-center hover:border-accent hover:text-accent">Add Key Date ↑</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `ClientStatusPanel` signature**

Already done in Task 17 (props now include `staff` not `partners`). Verify the props line in page.tsx matches.

- [ ] **Step 4: Type-check + commit**

```bash
npm run typecheck
git add 'src/app/admin/clients/[id]/page.tsx' 'src/app/admin/clients/[id]/QuickActions.tsx'
git -c commit.gpgsign=false commit -m "feat(ui): rewire client page to new editable components"
```

---

### Task 19: Phase 1 smoke

**Files:** none new.

- [ ] **Step 1: Sign in as `staff@oro.local`** and open `http://localhost/admin/clients/<some-id>`.
- [ ] **Step 2:** Edit profile — change companyName + country → Save → reload → persists.
- [ ] **Step 3:** Add a service (via the modal) → it appears → edit status to in_progress → Save → reload → persists.
- [ ] **Step 4:** Add a key date → mark complete → edit → delete.
- [ ] **Step 5:** Open the Documents section. Click the Company Formation folder anchor — confirm it scrolls to the matching section.
- [ ] **Step 6:** Upload a PDF into Company Formation. Click the filename — inline iframe opens. Change status to under_review. Delete it.
- [ ] **Step 7:** ComplianceBar shows status + risk + link → click → lands on `/admin/clients/[id]/compliance`.
- [ ] **Step 8:** Reassign primary staff via the modal.
- [ ] **Step 9:** Click each quick action — Send Message and Request Docs should 404 (Phase 2 will fill them). Add Service / Add Key Date scroll correctly.
- [ ] **Step 10:** `npm test && npm run typecheck` — both green.
- [ ] **Step 11:** Commit any tweaks the smoke walk uncovered with `chore: post-smoke fixups`.

---

## Phase 2 — Messaging + Document requests

### Task 20: Messages service + tests

**Files:**
- Create: `src/lib/services/messages.ts`
- Create: `src/lib/services/__tests__/messages.test.ts`

- [ ] **Step 1: Write the failing test (mocked Prisma + mocked email)**

`src/lib/services/__tests__/messages.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => {
  const messages: any[] = [];
  return {
    messages,
    reset() { messages.length = 0; },
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    message: {
      create: async ({ data }: any) => {
        const row = { id: `m-${db.messages.length + 1}`, ...data, createdAt: new Date() };
        db.messages.push(row);
        return row;
      },
      findMany: async () => db.messages,
    },
    client: {
      findUnique: async () => ({ id: "c1", user: { email: "c@x.com", fullName: "Client" } }),
    },
    activityLog: { create: async () => null },
  },
}));

const emailMock = vi.hoisted(() => ({ sent: [] as any[] }));
vi.mock("@/lib/providers/email", () => ({
  email: () => ({
    send: async (args: any) => { emailMock.sent.push(args); return { ok: true }; },
  }),
}));

import { sendMessage, listThread } from "../messages";

beforeEach(() => { db.reset(); emailMock.sent.length = 0; });

describe("sendMessage", () => {
  it("creates a Message row and fires an email", async () => {
    await sendMessage({ clientId: "c1", senderId: "s1", body: "Hello" });
    expect(db.messages).toHaveLength(1);
    expect(db.messages[0].body).toBe("Hello");
    expect(emailMock.sent).toHaveLength(1);
    expect(emailMock.sent[0].to).toBe("c@x.com");
  });
  it("listThread returns rows", async () => {
    await sendMessage({ clientId: "c1", senderId: "s1", body: "A" });
    await sendMessage({ clientId: "c1", senderId: "s1", body: "B" });
    expect(await listThread("c1")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx vitest run src/lib/services/__tests__/messages.test.ts
```

- [ ] **Step 3: Implement**

`src/lib/services/messages.ts`:
```ts
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { email } from "@/lib/providers/email";

export interface SendMessageInput {
  clientId: string;
  senderId: string;
  body: string;
}

export async function sendMessage(input: SendMessageInput) {
  if (input.body.trim().length === 0) throw new Error("Message body required");

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    include: { user: { select: { email: true, fullName: true } } },
  });
  if (!client) throw new Error("Client not found");

  const msg = await prisma.message.create({
    data: { clientId: input.clientId, senderId: input.senderId, body: input.body },
  });

  // Best-effort email; failure logged but doesn't roll back the message
  try {
    await email().send({
      to: client.user.email,
      subject: "New message from ORO",
      html: `<p>${escapeHtml(input.body).replace(/\n/g, "<br/>")}</p><p style="color:#888">Reply to this email to respond.</p>`,
    });
  } catch (e) {
    console.error("[sendMessage] email failed:", (e as Error).message);
  }

  await logActivity({
    entityType: "message", entityId: msg.id,
    action: "message.sent", actorId: input.senderId,
    meta: { clientId: input.clientId },
  });

  return msg;
}

export async function listThread(clientId: string) {
  return prisma.message.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 4: Run, confirm pass + commit**

```bash
npx vitest run src/lib/services/__tests__/messages.test.ts
git add src/lib/services/messages.ts src/lib/services/__tests__/messages.test.ts
git -c commit.gpgsign=false commit -m "feat(messages): add sendMessage + listThread (with email side-effect)"
```

---

### Task 21: Messages API routes + page

**Files:**
- Create: `src/app/api/admin/clients/[id]/messages/route.ts`
- Create: `src/app/admin/clients/[id]/messages/page.tsx`
- Create: `src/app/admin/clients/[id]/messages/MessageComposer.tsx`

- [ ] **Step 1: API routes**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { sendMessage, listThread } from "@/lib/services/messages";

export const runtime = "nodejs";

const schema = z.object({ body: z.string().min(1).max(10000) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertRole("staff");
  const { id } = await params;
  const messages = await listThread(id);
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  const msg = await sendMessage({ clientId: id, senderId: me.id, body: body.data.body });
  return NextResponse.json({ ok: true, id: msg.id });
}
```

- [ ] **Step 2: Page**

`src/app/admin/clients/[id]/messages/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { AdminClientShell } from "../AdminClientShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { listThread } from "@/lib/services/messages";
import { MessageComposer } from "./MessageComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, include: { user: true } });
  if (!client) notFound();

  const messages = await listThread(id);

  return (
    <AdminClientShell breadcrumb={`${client.user.fullName} · Messages`}>
      <div className="max-w-[800px]">
        <h1 className="font-display text-2xl mb-6">Messages with {client.user.fullName}</h1>

        <div className="bg-admin-surface border border-admin-border rounded-card p-6 mb-6 flex flex-col gap-4">
          {messages.length === 0 && <p className="text-meta text-admin-muted">No messages yet. Send the first one below.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender.role === "staff" ? "items-end" : "items-start"}`}>
              <div className="text-[11px] text-admin-muted">{m.sender.fullName} · {new Date(m.createdAt).toLocaleString()}</div>
              <div className={`mt-1 rounded-card px-4 py-2 max-w-[70%] ${m.sender.role === "staff" ? "bg-accent text-dark" : "bg-admin-bg"}`}>
                <p className="text-meta whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))}
        </div>

        <MessageComposer clientId={id} />
      </div>
    </AdminClientShell>
  );
}
```

- [ ] **Step 3: `MessageComposer`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MessageComposer({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  function send() {
    if (!body.trim()) return;
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) { setBody(""); router.refresh(); }
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Send failed"); }
    });
  }

  return (
    <div className="bg-admin-surface border border-admin-border rounded-card p-4">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" rows={4} className="input w-full" />
      <div className="flex justify-end mt-3">
        <button type="button" onClick={send} disabled={pending || !body.trim()} className="btn btn-primary px-4 py-2 disabled:opacity-50">
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Smoke + commit**

```bash
printf "GET /messages -> HTTP "
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost/admin/clients/x/messages"
git add 'src/app/api/admin/clients/[id]/messages' 'src/app/admin/clients/[id]/messages'
git -c commit.gpgsign=false commit -m "feat(messages): API + admin thread page + composer"
```

---

### Task 22: Document request API routes + page

**Files:**
- Create: `src/app/api/admin/clients/[id]/document-requests/route.ts`
- Create: `src/app/api/admin/document-requests/[id]/route.ts`
- Create: `src/app/admin/clients/[id]/request-docs/page.tsx`
- Create: `src/app/admin/clients/[id]/request-docs/RequestForm.tsx`

- [ ] **Step 1: Create POST route + email side-effect**

`src/app/api/admin/clients/[id]/document-requests/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { createDocumentRequest } from "@/lib/services/document-requests";
import { email } from "@/lib/providers/email";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const schema = z.object({
  description: z.string().min(3).max(500),
  serviceTypeKey: z.string().max(60).nullable().optional(),
  dueAt: z.string().date().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const created = await createDocumentRequest(id, body.data, me.id);

  const client = await prisma.client.findUnique({ where: { id }, include: { user: { select: { email: true, fullName: true } } } });
  if (client) {
    try {
      await email().send({
        to: client.user.email,
        subject: "ORO has requested a document",
        html: `<p>Hi ${client.user.fullName},</p>
               <p>We've requested the following document:</p>
               <p><b>${escapeHtml(body.data.description)}</b></p>
               <p>You can reply to this email with the file, or log in at ${env().APP_URL} to upload it.</p>`,
      });
    } catch (e) {
      console.error("[doc-request] email failed:", (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, id: created.id });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 2: PATCH (cancel) route**

`src/app/api/admin/document-requests/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRole } from "@/lib/auth/guards";
import { cancelDocumentRequest } from "@/lib/services/document-requests";

export const runtime = "nodejs";

const schema = z.object({ state: z.literal("cancelled") });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await assertRole("staff");
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  try {
    await cancelDocumentRequest(id, me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: `/request-docs` page**

```tsx
import { notFound } from "next/navigation";
import { AdminClientShell } from "../AdminClientShell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { RequestForm } from "./RequestForm";
import { CancelRequestClient } from "../CancelRequestClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request documents" };

export default async function RequestDocsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { user: true, services: true, documentRequests: { orderBy: { createdAt: "desc" }, include: { fulfilledDocument: true } } },
  });
  if (!client) notFound();
  const taxonomy = await prisma.service.findMany({ where: { active: true }, select: { key: true, label: true }, orderBy: { sortOrder: "asc" } });

  return (
    <AdminClientShell breadcrumb={`${client.user.fullName} · Request docs`}>
      <div className="max-w-[800px]">
        <h1 className="font-display text-2xl mb-6">Request documents from {client.user.fullName}</h1>
        <RequestForm clientId={id} taxonomy={taxonomy} />

        <h2 className="font-display text-xl mt-10 mb-4">History</h2>
        <div className="bg-admin-surface border border-admin-border rounded-card p-4">
          <ul className="flex flex-col gap-3">
            {client.documentRequests.length === 0 && <p className="text-meta text-admin-muted">No requests yet.</p>}
            {client.documentRequests.map((r) => (
              <li key={r.id} className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-meta">{r.description}</div>
                  <div className="text-[12px] text-admin-muted">
                    {r.serviceTypeKey ? `Service: ${r.serviceTypeKey} · ` : ""}
                    {r.dueAt ? `Due ${new Date(r.dueAt).toLocaleDateString()} · ` : ""}
                    State: <span className="font-mono">{r.state}</span>
                  </div>
                </div>
                {r.state === "open" && <CancelRequestClient id={r.id} />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminClientShell>
  );
}
```

- [ ] **Step 4: `RequestForm`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RequestForm({ clientId, taxonomy }: { clientId: string; taxonomy: { key: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: fd.get("description"),
          serviceTypeKey: fd.get("serviceTypeKey") || null,
          dueAt: fd.get("dueAt") || null,
        }),
      });
      if (res.ok) router.refresh();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); }
    });
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); (e.currentTarget as HTMLFormElement).reset(); }}
      className="bg-admin-surface border border-admin-border rounded-card p-4 flex flex-col gap-3"
    >
      <input name="description" required placeholder="What document do you need? (e.g. Latest bank statement)" className="input" />
      <div className="grid gap-3 md:grid-cols-2">
        <select name="serviceTypeKey" defaultValue="" className="input">
          <option value="">No service (general)</option>
          {taxonomy.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input name="dueAt" type="date" className="input" />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary px-4 py-2">{pending ? "Sending…" : "Send request"}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Smoke + commit**

```bash
for p in /api/admin/clients/x/document-requests /api/admin/document-requests/x /admin/clients/x/request-docs; do
  printf "%-55s -> HTTP " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost$p"
done
git add 'src/app/api/admin/clients/[id]/document-requests' 'src/app/api/admin/document-requests' 'src/app/admin/clients/[id]/request-docs'
git -c commit.gpgsign=false commit -m "feat(doc-requests): API + admin page + form"
```

---

### Task 23: Phase 2 smoke

**Files:** none new.

- [ ] **Step 1: Sign in as `staff@oro.local`.** Navigate to a client → click `Send Message`.
- [ ] **Step 2:** Send a message. Confirm it appears in the thread.
- [ ] **Step 3:** Open Mailpit at `http://localhost:8025` — the message-notification email is there.
- [ ] **Step 4:** Click `Request Docs`. Submit a request (description + service + due date). Email visible in Mailpit.
- [ ] **Step 5:** Open the client main page — the request appears in the matching service folder under "Open requests".
- [ ] **Step 6:** Cancel the request. Page refreshes, request disappears.
- [ ] **Step 7:** Create a new request. Upload a doc into the matching folder using the existing upload button. Make sure the request stays open (since this upload didn't have `fulfillsRequestId`).
- [ ] **Step 8:** `npm test && npm run typecheck` green.
- [ ] **Step 9:** Commit any fixups: `chore: post-smoke fixups`.

---

## Self-review (executed by plan author)

**Spec coverage:**
- §3.1 Client extension → Task 1 ✓
- §3.2 Document.serviceTypeKey → Task 1 ✓
- §3.3 DocumentRequest model → Task 1 ✓
- §4 Page layout → Tasks 12–18 ✓
- §5.1 PATCH /clients/[id] extension → Task 8 ✓
- §5.2 Phase 1 routes → Tasks 9–11 ✓
- §5.3 Phase 2 routes → Tasks 21–22 ✓
- §6 Service organisation → Tasks 4–7 (Phase 1), 20 (Phase 2) ✓
- §6.1 ActivityLog extensions → Task 2 ✓
- §7 UI components → Tasks 12–18, 21–22 ✓
- §8 Lifecycle flows → exercised by smoke tasks 19, 23 ✓
- §9 Edge cases → addressed in service implementations + smoke ✓
- §10 Out of scope → respected (no booking, no archive, no portal, no attachments)

**Placeholder scan:** No "TBD" / "similar to" / vague directives. Step 2 of Task 14 contains an intentional NOTE clarifying a small type adjustment — that's plan guidance, not a placeholder.

**Type consistency:**
- `ServiceRow` includes `clientId` in both `ServicesEngagedList` and `ServiceRowClient`.
- `DocRow` shape consistent between `DocumentsSection` (server) and `DocumentRow` (client).
- API path `/api/admin/clients/[id]/services/[serviceId]` matches the route file location.
- `bucketDocument` import path consistent between Task 3 (creation) and Task 16 (consumer).
- `ClientStatusPanel` prop change to `staff` is updated in both Task 17 and Task 18.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-24-client-page-functional.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review per the workflow used for the KYC build.

**2. Inline Execution** — Execute tasks in this session using executing-plans.
