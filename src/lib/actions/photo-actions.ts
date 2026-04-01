"use server";

/**
 * Photo actions — Sprint D2, Task gov-1775041297153-uzp0s2
 *
 * Implementa: uploadPhoto, linkPhotoToIssue, listPhotosByIssue, listPhotosByProject, deletePhoto
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEntry } from "@/lib/services/audit-log";

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/tiff",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateImageMimeType(mimeType: string, fileName: string): void {
  if (!ACCEPTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(
      `mimeType inválido: ${mimeType} não é suportado para fotos (fileName: ${fileName}). Apenas imagens são aceites.`,
    );
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function uploadPhoto(input: {
  orgId: string;
  projectId: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
  gpsMetadata?: {
    latitude: number;
    longitude: number;
    altitude: number | null;
  } | null;
  isMobile?: boolean;
}): Promise<{ id: string; mimeType: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  validateImageMimeType(input.mimeType, input.fileName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const doc = await db.document.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      folderId: input.folderId,
      originalName: input.fileName,
      storageKey: `${input.orgId}/${input.projectId}/${input.folderId}/${input.fileHash}/${input.fileName}`,
      fileHash: input.fileHash,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      status: "PENDING",
      uploadedById: session.user.id!,
      metadata: input.gpsMetadata
        ? {
            gps: {
              latitude: input.gpsMetadata.latitude,
              longitude: input.gpsMetadata.longitude,
              altitude: input.gpsMetadata.altitude ?? null,
            },
            isMobile: input.isMobile ?? false,
          }
        : undefined,
    },
  });

  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Photo",
    entityId: doc.id,
    action: "CREATE",
    userId: session.user.id!,
    payload: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      gps: input.gpsMetadata ?? null,
      isMobile: input.isMobile ?? false,
    },
  });

  return { id: doc.id, mimeType: doc.mimeType, status: doc.status as string };
}

export async function linkPhotoToIssue(input: {
  issueId: string;
  orgId: string;
  fileName: string;
  fileUrl: string;
  fileHash: string;
  fileSizeBytes: number;
  mimeType: string;
  gpsMetadata?: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
}): Promise<{
  id: string;
  issueId: string;
  type: string;
  metadata?: unknown;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const issue = await prisma.issue.findUnique({
    where: { id: input.issueId },
  });
  if (!issue) throw new Error("issue não encontrada (404).");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  return db.evidence.create({
    data: {
      orgId: input.orgId,
      issueId: input.issueId,
      type: "FOTO",
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileHash: input.fileHash,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      metadata: input.gpsMetadata ?? undefined,
      uploadedById: session.user.id!,
    },
  });
}

export async function listPhotosByIssue(input: {
  issueId: string;
  orgId: string;
}): Promise<Array<{ id: string; type: string; issueId: string }>> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  return db.evidence.findMany({
    where: { issueId: input.issueId, type: "FOTO", orgId: input.orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPhotosByProject(input: {
  projectId: string;
  orgId: string;
  page?: number;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    type: string;
    issueId: string;
    issue: { projectId: string };
  }>
> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  return db.evidence.findMany({
    where: {
      type: "FOTO",
      orgId: input.orgId,
      issue: { projectId: input.projectId },
    },
    include: { issue: true },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });
}

export async function deletePhoto(input: {
  photoId: string;
  orgId: string;
}): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const evidence = await db.evidence.findFirst({
    where: { id: input.photoId, orgId: input.orgId, type: "FOTO" },
  });
  if (!evidence) throw new Error("Foto não encontrada (404).");

  await db.evidence.delete({ where: { id: input.photoId } });

  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Photo",
    entityId: input.photoId,
    action: "DELETE",
    userId: session.user.id!,
    payload: { deletedAt: new Date().toISOString() },
  });

  return { success: true };
}
