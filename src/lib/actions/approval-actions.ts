/**
 * Approval actions — Sprint D2 stubs (E3 TDD)
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

export async function submitApproval(input: {
  documentId: string;
  orgId: string;
  folderId: string;
}): Promise<{ id: string; status: string; submittedById: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return db.approval.create({
    data: {
      documentId: input.documentId,
      orgId: input.orgId,
      folderId: input.folderId,
      submittedById: session.user.id,
      status: "PENDING_REVIEW",
    },
  });
}

export async function approveDocument(input: {
  approvalId: string;
  orgId?: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const approval = await db.approval.findUnique({
    where: { id: input.approvalId },
    include: { document: true },
  });
  if (!approval) throw new Error("Aprovação não encontrada (404).");

  // Verificar permissão APPROVE na pasta
  const acl = await prisma.folderAcl.findFirst({
    where: { folderId: approval.folderId, userId: session.user.id },
  });
  const perms = (acl?.permissions ?? []) as string[];
  if (!perms.includes("APPROVE")) {
    throw new Error("403: sem permissão APPROVE nesta pasta.");
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
    // Update Document to CONFIRMED if available in transaction context
    if (txDb.document?.update) {
      await txDb.document.update({
        where: { id: approval.documentId },
        data: { status: "CONFIRMED" },
      });
    }
    return txDb.approval.update({
      where: { id: approval.id },
      data: { status: "APPROVED" },
    });
  });
}

export async function rejectApproval(input: {
  approvalId: string;
  note: string;
  orgId?: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (!input.note || input.note.trim() === "") {
    throw new Error("note é obrigatório para rejeição (motivo).");
  }
  const approval = await db.approval.findUnique({
    where: { id: input.approvalId },
    include: { document: true },
  });
  if (!approval) throw new Error("Aprovação não encontrada.");

  const acl = await prisma.folderAcl.findFirst({
    where: { folderId: approval.folderId, userId: session.user.id },
  });
  const perms = (acl?.permissions ?? []) as string[];
  if (!perms.includes("APPROVE")) {
    throw new Error("403: sem permissão APPROVE nesta pasta.");
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
        toState: "REJECTED",
        userId: session!.user!.id,
        note: input.note,
        hash: "stub-hash",
      },
    });
    await txDb.auditLog.create({
      data: {
        orgId: approval.orgId,
        entityType: "Approval",
        entityId: approval.id,
        action: "REJECT",
        userId: session!.user!.id,
        hash: "stub-hash",
      },
    });
    return txDb.approval.update({
      where: { id: approval.id },
      data: { status: "REJECTED" },
    });
  });
}

export async function cancelApproval(input: {
  approvalId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const approval = await db.approval.findUnique({
    where: { id: input.approvalId },
  });
  if (!approval) throw new Error("Aprovação não encontrada.");
  if (approval.submittedById !== session.user.id) {
    throw new Error(
      "Não pode cancelar: apenas o submitter pode cancelar a aprovação (permissão negada).",
    );
  }
  return db.approval.update({
    where: { id: approval.id },
    data: { status: "CANCELLED" },
  });
}
