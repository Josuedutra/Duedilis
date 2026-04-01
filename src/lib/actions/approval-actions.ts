"use server";

/**
 * Approval actions — Sprint D2
 * Task: gov-1775041316173-u4jhw6 (D2-12: AuditLog integration)
 *
 * Modelo Approval ainda não existe no schema — usa (prisma as any).
 * AuditLog integrado com hash chain via createAuditEntry service.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEntry } from "@/lib/services/audit-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function submitApproval(input: {
  documentId: string;
  orgId: string;
  folderId: string;
}): Promise<{ id: string; status: string; submittedById: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const approval = await db.approval.create({
    data: {
      documentId: input.documentId,
      orgId: input.orgId,
      folderId: input.folderId,
      submittedById: session.user.id,
      status: "PENDING_REVIEW",
    },
  });
  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Approval",
    entityId: approval.id,
    action: "CREATE",
    userId: session.user.id!,
    payload: { documentId: input.documentId, status: "PENDING_REVIEW" },
  });
  return approval;
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

  const result = await prisma.$transaction(async (tx) => {
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
  // Criar entry no AuditLog com hash chain real
  await createAuditEntry({
    orgId: approval.orgId,
    entityType: "Approval",
    entityId: approval.id,
    action: "APPROVE",
    userId: session!.user!.id!,
    payload: {
      documentId: approval.documentId,
      fromStatus: "PENDING_REVIEW",
      toStatus: "APPROVED",
    },
  });
  return result;
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

  const result = await prisma.$transaction(async (tx) => {
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
    return txDb.approval.update({
      where: { id: approval.id },
      data: { status: "REJECTED" },
    });
  });
  await createAuditEntry({
    orgId: approval.orgId,
    entityType: "Approval",
    entityId: approval.id,
    action: "REJECT",
    userId: session!.user!.id!,
    payload: {
      note: input.note,
      fromStatus: "PENDING_REVIEW",
      toStatus: "REJECTED",
    },
  });
  return result;
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
  const result = await db.approval.update({
    where: { id: approval.id },
    data: { status: "CANCELLED" },
  });
  await createAuditEntry({
    orgId: approval.orgId,
    entityType: "Approval",
    entityId: approval.id,
    action: "CANCEL",
    userId: session.user.id!,
    payload: { fromStatus: "PENDING_REVIEW", toStatus: "CANCELLED" },
  });
  return result;
}
