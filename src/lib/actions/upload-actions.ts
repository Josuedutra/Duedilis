/**
 * Upload pipeline actions — Sprint D2 stubs (E3 TDD)
 * Task: gov-1775041180765-0yiwrq
 *
 * STUBS — shell mínimo para que os imports dos testes resolvam.
 * Lógica de negócio implementada na Etapa E4.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function presignUpload(input: {
  orgId: string;
  projectId: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<{ key: string; uploadUrl: string; expiresAt: Date }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  // E4: substituir por chamada real à R2 API para gerar presigned URL
  const key = `/${input.orgId}/${input.projectId}/${input.folderId}/${Date.now()}-${input.fileName}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  return {
    key,
    uploadUrl: `https://stub-r2.example.com${key}?stub=true`,
    expiresAt,
  };
}

export async function verifyUploadHash(_input: {
  documentId: string;
  receivedHash: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const doc = await prisma.document.findUnique({
    where: { id: _input.documentId },
  });
  if (!doc) throw new Error("Documento não encontrado.");
  if (doc.fileHash !== _input.receivedHash) {
    throw new Error("hash inválido: SHA-256 mismatch.");
  }
  const updated = await prisma.document.update({
    where: { id: _input.documentId },
    data: { status: "NORMALIZING" },
  });
  return { id: updated.id, status: updated.status as string };
}

export async function createUploadBatch(_input: {
  orgId: string;
  projectId: string;
  folderId: string;
  files: Array<{
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileHash: string;
  }>;
}): Promise<{ batchId: string; presignedUrls: string[] }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  if (_input.files.length > 50)
    throw new Error("limite de 50 ficheiros por batch excedido (400).");
  const oversized = _input.files.find(
    (f) => f.fileSizeBytes > 100 * 1024 * 1024,
  );
  if (oversized)
    throw new Error(
      `tamanho máximo 100MB excedido: ${oversized.fileName} (400).`,
    );
  const batch = await prisma.uploadBatch.create({
    data: {
      orgId: _input.orgId,
      projectId: _input.projectId,
      folderId: _input.folderId,
      uploadedById: session.user.id!,
      totalFiles: _input.files.length,
    },
  });
  return { batchId: batch.id, presignedUrls: [] };
}

export async function confirmBatch(_input: {
  batchId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const batch = await prisma.uploadBatch.findUnique({
    where: { id: _input.batchId },
  });
  if (!batch) throw new Error("Batch não encontrado.");
  if (batch.status !== "READY")
    throw new Error(
      `estado inválido: não pode confirmar batch com estado ${batch.status}. Requerido: READY.`,
    );
  return prisma.$transaction(async () => ({
    id: batch.id,
    status: "CONFIRMED",
  }));
}

export async function createIndividualDocument(_input: {
  orgId: string;
  projectId: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
}): Promise<{ id: string; status: string; batchId: null }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  const doc = await prisma.document.create({
    data: {
      orgId: _input.orgId,
      projectId: _input.projectId,
      folderId: _input.folderId,
      originalName: _input.fileName,
      storageKey: `/${_input.orgId}/${_input.projectId}/${_input.folderId}/${_input.fileName}`,
      fileHash: _input.fileHash,
      fileSizeBytes: _input.fileSizeBytes,
      mimeType: _input.mimeType,
      status: "PENDING",
      uploadedById: session.user.id!,
      batchId: null,
    },
  });
  return { id: doc.id, status: doc.status as string, batchId: null };
}
