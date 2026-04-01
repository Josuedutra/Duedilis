"use server";

/**
 * CDE actions — Sprint D2
 * Task: gov-1775041228837-pj6dba
 *
 * Server actions: createCdeFolder, listCdeFolders, checkFolderPermission,
 *                 createDocumentVersion, transitionDocumentStatus, listDocumentsByFolder
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEntry } from "@/lib/services/audit-log";

export async function createCdeFolder(input: {
  orgId: string;
  projectId: string;
  name: string;
  parentId: string | null;
}): Promise<{
  id: string;
  name: string;
  parentId: string | null;
  path: string;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const folder = await prisma.cdeFolder.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      name: input.name,
      parentId: input.parentId ?? null,
      path: `/${input.orgId}/${input.projectId}/${input.name}`,
    },
  });
  await createAuditEntry({
    orgId: input.orgId,
    entityType: "CdeFolder",
    entityId: folder.id,
    action: "CREATE",
    userId: session.user.id!,
    payload: { name: input.name, parentId: input.parentId ?? null },
  });
  return folder;
}

export async function listCdeFolders(input: {
  orgId: string;
  projectId: string;
}): Promise<Array<{ id: string; name: string; projectId: string }>> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return prisma.cdeFolder.findMany({
    where: { orgId: input.orgId, projectId: input.projectId },
  });
}

export async function checkFolderPermission(input: {
  userId: string;
  folderId: string;
  requiredPermission: string;
}): Promise<boolean> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const acl = await prisma.folderAcl.findFirst({
    where: { folderId: input.folderId, userId: input.userId },
  });
  if (!acl) return false;
  return (acl.permissions as string[]).includes(input.requiredPermission);
}

export async function createDocumentVersion(input: {
  orgId: string;
  projectId: string;
  folderId: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
  revision: string;
}): Promise<{ id: string; status: string; revision: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const existing = await prisma.document.findMany({
    where: {
      orgId: input.orgId,
      folderId: input.folderId,
      originalName: input.originalName,
      status: { not: "REJECTED" }, // E4: use SUPERSEDED once added to DocumentStatus enum
    },
  });
  const result = await prisma.$transaction(async (tx) => {
    for (const doc of existing) {
      await tx.document.update({
        where: { id: doc.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: "SUPERSEDED" as any }, // E4: add SUPERSEDED to DocumentStatus enum
      });
    }
    const doc = await tx.document.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        folderId: input.folderId,
        originalName: input.originalName,
        revision: input.revision,
        storageKey: `/${input.orgId}/${input.projectId}/${input.folderId}/${input.originalName}`,
        fileHash: input.fileHash,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        status: "PENDING",
        uploadedById: session!.user!.id!,
      },
    });
    return {
      id: doc.id,
      status: doc.status as string,
      revision: doc.revision ?? input.revision,
    };
  });
  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Document",
    entityId: result.id,
    action: "CREATE",
    userId: session!.user!.id!,
    payload: {
      revision: input.revision,
      originalName: input.originalName,
      supersededCount: existing.length,
    },
  });
  return result;
}

export async function transitionDocumentStatus(input: {
  documentId: string;
  toStatus: string;
  /** Optional: override isoName when transitioning to CONFIRMED (user edit) */
  isoName?: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
  });
  if (!doc) throw new Error("Documento não encontrado.");

  // Transições válidas
  const validTransitions: Record<string, string[]> = {
    PENDING: ["NORMALIZING"],
    NORMALIZING: ["READY"],
    READY: ["CONFIRMED", "REJECTED"],
    CONFIRMED: [],
    REJECTED: [],
  };
  const allowed = validTransitions[doc.status] ?? [];
  if (!allowed.includes(input.toStatus)) {
    throw new Error(
      `transição inválida: ${doc.status} → não pode transitar para ${input.toStatus}.`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { status: input.toStatus };
  // Allow overriding isoName when user edits manually before confirming
  if (input.isoName !== undefined) {
    updateData.isoName = input.isoName;
  }
  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: updateData,
  });
  await createAuditEntry({
    orgId: doc.orgId,
    entityType: "Document",
    entityId: updated.id,
    action: "TRANSITION",
    userId: session.user.id!,
    payload: { fromStatus: doc.status as string, toStatus: input.toStatus },
  });
  return { id: updated.id, status: updated.status as string };
}

export async function listDocumentsByFolder(input: {
  orgId: string;
  folderId: string;
  limit: number;
  offset: number;
}): Promise<Array<{ id: string; originalName: string; folderId: string }>> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return prisma.document.findMany({
    where: { orgId: input.orgId, folderId: input.folderId },
    take: input.limit,
    skip: input.offset,
  });
}
