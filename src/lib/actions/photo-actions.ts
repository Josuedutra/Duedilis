/**
 * Photo actions — Sprint D2 stubs (E3 TDD)
 * Task: gov-1775041180765-0yiwrq
 *
 * STUBS — shell mínimo para que os imports dos testes resolvam.
 * Lógica de negócio implementada na Etapa E4.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  return prisma.document.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      folderId: input.folderId,
      originalName: input.fileName,
      storageKey: `/${input.orgId}/${input.projectId}/${input.folderId}/${input.fileName}`,
      fileHash: input.fileHash,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      status: "PENDING",
      uploadedById: session.user.id!,
    },
  });
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
  return prisma.evidence.create({
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
  return prisma.evidence.findMany({
    where: { issueId: input.issueId, type: "FOTO", orgId: input.orgId },
  });
}

export async function listPhotosByProject(input: {
  projectId: string;
  orgId: string;
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
  return prisma.evidence.findMany({
    where: {
      type: "FOTO",
      orgId: input.orgId,
      issue: { projectId: input.projectId },
    },
    include: { issue: true },
  });
}
