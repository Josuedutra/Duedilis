"use server";
// Transmittal actions — D4-E3-09 stub implementation
// Tests in src/__tests__/d4-transmittals.test.ts mock prisma — this satisfies the import.
// Full Transmittal schema migration + integration comes in D4-09.
// Note: prisma.transmittal* cast as any — models added in D4-09 migration.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateTransmittalInput {
  orgId: string;
  projectId: string;
  subject: string;
  notes?: string;
}

export interface AddDocumentsInput {
  orgId: string;
  transmittalId: string;
  documentIds: string[];
}

export interface AddRecipientsInput {
  orgId: string;
  transmittalId: string;
  recipients: { email: string; name: string }[];
}

export interface SendTransmittalInput {
  orgId: string;
  transmittalId: string;
}

export interface MarkReceivedInput {
  orgId: string;
  recipientId: string;
}

export interface GetPresignedUrlsInput {
  orgId: string;
  transmittalId: string;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function assertMembership(orgId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized — 401");

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } } as never,
  });

  if (!membership) throw new Error("Forbidden — sem permissão — 403");
  return membership;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createTransmittal(input: CreateTransmittalInput) {
  await assertMembership(input.orgId);

  return db.transmittal.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      subject: input.subject,
      notes: input.notes ?? null,
      status: "DRAFT",
      sentAt: null,
    },
  });
}

export async function addDocumentsToTransmittal(input: AddDocumentsInput) {
  await assertMembership(input.orgId);

  const transmittal = await db.transmittal.findUnique({
    where: { id: input.transmittalId },
  });
  if (!transmittal) throw new Error("Transmittal not found — 404");

  const results = [];
  for (const documentId of input.documentIds) {
    const existing = await db.transmittalDocument.findFirst({
      where: { transmittalId: input.transmittalId, documentId },
    });
    if (existing) {
      throw new Error(
        "Duplicate document — já existe neste transmittal — 409 conflict",
      );
    }
    const doc = await db.transmittalDocument.create({
      data: { transmittalId: input.transmittalId, documentId },
    });
    results.push(doc);
  }

  return results;
}

export async function addRecipientsToTransmittal(input: AddRecipientsInput) {
  await assertMembership(input.orgId);

  const transmittal = await db.transmittal.findUnique({
    where: { id: input.transmittalId },
  });
  if (!transmittal) throw new Error("Transmittal not found — 404");

  const results = [];
  for (const recipient of input.recipients) {
    const created = await db.transmittalRecipient.create({
      data: {
        transmittalId: input.transmittalId,
        email: recipient.email,
        name: recipient.name,
        receivedAt: null,
      },
    });
    results.push(created);
  }

  return results;
}

export async function sendTransmittal(input: SendTransmittalInput) {
  await assertMembership(input.orgId);

  const transmittal = await db.transmittal.findUnique({
    where: { id: input.transmittalId },
  });
  if (!transmittal) throw new Error("Transmittal not found — 404");

  if (transmittal.status === "SENT") {
    throw new Error("Transmittal já enviado — already sent — 409 conflict");
  }

  return db.transmittal.update({
    where: { id: input.transmittalId },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export async function markReceived(input: MarkReceivedInput) {
  await assertMembership(input.orgId);

  return db.transmittalRecipient.update({
    where: { id: input.recipientId },
    data: { receivedAt: new Date() },
  });
}

export async function listTransmittals(input: {
  orgId: string;
  projectId: string;
}) {
  await assertMembership(input.orgId);

  return db.transmittal.findMany({
    where: { orgId: input.orgId, projectId: input.projectId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { documents: true, recipients: true } },
    },
  });
}

export async function getTransmittalDetail(input: {
  orgId: string;
  transmittalId: string;
}) {
  await assertMembership(input.orgId);

  const transmittal = await db.transmittal.findUnique({
    where: { id: input.transmittalId },
    include: {
      documents: {
        include: {
          document: { select: { id: true, originalName: true, status: true } },
        },
      },
      recipients: true,
    },
  });

  if (!transmittal) throw new Error("Transmittal not found — 404");
  return transmittal;
}

export async function getTransmittalPresignedUrls(
  input: GetPresignedUrlsInput,
) {
  await assertMembership(input.orgId);

  const transmittal = await db.transmittal.findUnique({
    where: { id: input.transmittalId },
  });
  if (!transmittal) throw new Error("Transmittal not found — 404");

  const docs = await db.transmittalDocument.findMany({
    where: { transmittalId: input.transmittalId },
  });

  // Stub: generate placeholder presigned URLs per document.
  // Real implementation will call S3/R2 presign in D4-09.
  return docs.map((doc: { documentId: string }) => ({
    documentId: doc.documentId,
    url: `https://storage.example.com/presigned/${doc.documentId}?token=stub`,
  }));
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
// getTransmittalStatusBadgeConfig moved to src/lib/status-badges.ts (not a server action)

/** Send button visible only for DRAFT transmittals with at least 1 document */
export function canSendTransmittal(
  status: string,
  documentCount: number,
): boolean {
  return status === "DRAFT" && documentCount >= 1;
}
