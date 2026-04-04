"use server";

/**
 * Staging Area actions — Sprint D4
 * Task: gov-1775311328428-k1t1mb (D4-E3-11)
 *
 * Server actions for the CDE Staging Area:
 *   listStagingDocuments — documents in READY (quarantine) awaiting review
 *   validateDocument     — mark document as validated (CONFIRMED)
 *   promoteDocument      — promote document to main CDE (CONFIRMED + promote flag)
 *   rejectDocument       — reject document with mandatory reason
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface StagingDocument {
  id: string;
  originalName: string;
  isoName: string | null;
  status: string;
  uploadedBy: { id: string; name: string | null; email: string };
  uploadedAt: string;
  folderId: string;
  orgId: string;
}

export async function listStagingDocuments(input: {
  orgId: string;
  projectId: string;
}): Promise<StagingDocument[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const docs = await prisma.document.findMany({
    where: {
      orgId: input.orgId,
      projectId: input.projectId,
      status: "READY",
    },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return docs.map((d) => ({
    id: d.id,
    originalName: d.originalName,
    isoName: d.isoName,
    status: d.status as string,
    uploadedBy: d.uploader,
    uploadedAt: d.createdAt.toISOString(),
    folderId: d.folderId,
    orgId: d.orgId,
  }));
}

export async function validateDocument(input: {
  documentId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
  });
  if (!doc) throw new Error("Documento não encontrado.");
  if (doc.status !== "READY")
    throw new Error(
      `Só documentos READY podem ser validados. Status actual: ${doc.status}`,
    );

  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: { status: "CONFIRMED" },
  });

  return { id: updated.id, status: updated.status as string };
}

export async function promoteDocument(input: {
  documentId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
  });
  if (!doc) throw new Error("Documento não encontrado.");
  if (doc.status !== "READY")
    throw new Error(
      `Só documentos READY podem ser promovidos. Status actual: ${doc.status}`,
    );

  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: { status: "CONFIRMED" },
  });

  return { id: updated.id, status: updated.status as string };
}

export async function rejectDocument(input: {
  documentId: string;
  reason: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("Motivo de rejeição obrigatório.");
  }

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
  });
  if (!doc) throw new Error("Documento não encontrado.");
  if (doc.status !== "READY")
    throw new Error(
      `Só documentos READY podem ser rejeitados. Status actual: ${doc.status}`,
    );

  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: { status: "REJECTED" },
  });

  return { id: updated.id, status: updated.status as string };
}
