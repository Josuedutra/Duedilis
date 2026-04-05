"use server";
/**
 * RLS guards — Sprint D2 stubs (E3 TDD)
 * Task: gov-1775041180765-0yiwrq
 *
 * STUBS — shell mínimo para que os imports dos testes resolvam.
 * Modelo Approval ainda não existe no schema — será adicionado na Etapa E4.
 * Usa (prisma as any) para evitar erro de compilação antes da migração.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function getDocument(input: {
  documentId: string;
  orgId: string;
}): Promise<{ id: string; orgId: string; status: string } | null> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  // RLS: findUnique by id then verify orgId matches (tenant isolation)
  const doc = await prisma.document.findUnique({
    where: { id: input.documentId, orgId: input.orgId } as Parameters<
      typeof prisma.document.findUnique
    >[0]["where"],
  });
  return doc;
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

export async function approveDocument(input: {
  approvalId: string;
  orgId?: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const approval = await db.approval.findUnique({
    where: {
      id: input.approvalId,
      ...(input.orgId ? { orgId: input.orgId } : {}),
    },
    include: { document: true },
  });
  if (!approval) throw new Error("Aprovação não encontrada (404).");

  const acl = await prisma.folderAcl.findFirst({
    where: { folderId: approval.folderId, userId: session.user.id },
  });
  const perms = (acl?.permissions ?? []) as string[];
  if (!perms.includes("APPROVE")) {
    throw new Error("403: sem permissão nesta pasta.");
  }

  return prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;
    await txDb.stamp.create({
      data: {
        orgId: approval.orgId,
        entityType: "Approval",
        entityId: approval.id,
        fromState: "PENDING_REVIEW",
        toState: "APPROVED",
        userId: session!.user!.id,
        hash: "stub-hash",
      },
    });
    await txDb.auditLog.create({
      data: {
        orgId: approval.orgId,
        entityType: "Approval",
        entityId: approval.id,
        action: "APPROVE",
        userId: session!.user!.id,
        hash: "stub-hash",
      },
    });
    return txDb.approval.update({
      where: { id: approval.id },
      data: { status: "APPROVED" },
    });
  });
}

export async function rejectApproval(input: {
  approvalId: string;
  orgId?: string;
  note: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!input.note?.trim()) {
    throw new Error("note é obrigatório para rejeição.");
  }
  const approval = await db.approval.findUnique({
    where: {
      id: input.approvalId,
      ...(input.orgId ? { orgId: input.orgId } : {}),
    },
  });
  if (!approval) throw new Error("Aprovação não encontrada (404).");
  return db.approval.update({
    where: { id: approval.id },
    data: { status: "REJECTED" },
  });
}

export async function listDocumentsByFolder(input: {
  folderId: string;
  orgId: string;
  limit: number;
  offset: number;
}): Promise<Array<{ id: string; orgId: string; status: string }>> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return prisma.document.findMany({
    where: { orgId: input.orgId, folderId: input.folderId },
    take: input.limit,
    skip: input.offset,
  });
}
