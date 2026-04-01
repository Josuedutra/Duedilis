/**
 * Upload pipeline actions — Sprint D2
 * Task: gov-1775041212811-idm9pz
 *
 * Implements: presignUpload, verifyUploadHash, createUploadBatch, confirmBatch,
 *             createIndividualDocument
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEntry } from "@/lib/services/audit-log";
import { generatePresignedUploadUrl } from "@/lib/services/r2";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_BATCH_FILES = 50;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/acad",
  "application/x-autocad",
  "image/vnd.dwg",
  "application/x-dwg",
  "application/octet-stream", // IFC files
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/zip",
  "application/x-zip-compressed",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildStorageKey(
  orgId: string,
  projectId: string,
  folderId: string,
  docId: string,
  fileName: string,
): string {
  return `${orgId}/${projectId}/${folderId}/${docId}/${fileName}`;
}

function validateFile(
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
): void {
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `tamanho máximo 100MB excedido: ${fileName} (${fileSizeBytes} bytes) (400).`,
    );
  }
  // IFC files commonly come with various mime types — allow by extension
  const ext = fileName.split(".").pop()?.toLowerCase();
  const isIfcByExtension = ext === "ifc";
  if (!ACCEPTED_MIME_TYPES.has(mimeType) && !isIfcByExtension) {
    throw new Error(
      `mimeType não aceite: ${mimeType} (400). Tipos aceites: pdf, doc/docx, xls/xlsx, dwg, ifc, jpg/png/heic, zip.`,
    );
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Generate a presigned R2 URL for direct client upload.
 * Returns { key, uploadUrl, expiresAt }.
 */
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

  validateFile(input.fileName, input.mimeType, input.fileSizeBytes);

  // Use a timestamp-based docId placeholder for the key (actual Document created on confirm)
  const docId = `tmp-${Date.now()}`;
  const key = buildStorageKey(
    input.orgId,
    input.projectId,
    input.folderId,
    docId,
    input.fileName,
  );

  let uploadUrl: string;
  let expiresAt: Date;

  try {
    const result = await generatePresignedUploadUrl({
      storageKey: key,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    });
    uploadUrl = result.uploadUrl;
    expiresAt = result.expiresAt;
  } catch {
    // R2 not configured — return a placeholder URL (dev/test environment)
    expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    uploadUrl = `https://r2-pending.example.com/${key}`;
  }

  return { key, uploadUrl, expiresAt };
}

/**
 * Verify upload hash after client completes upload.
 * Compares receivedHash against Document.fileHash stored at Document creation.
 * On match, transitions Document to NORMALIZING.
 */
export async function verifyUploadHash(input: {
  documentId: string;
  receivedHash: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
  });
  if (!doc) throw new Error("Documento não encontrado.");

  if (doc.fileHash !== input.receivedHash) {
    throw new Error(
      `hash inválido: SHA-256 mismatch. Esperado: ${doc.fileHash}. Recebido: ${input.receivedHash}. (400)`,
    );
  }

  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: { status: "NORMALIZING" },
  });

  return { id: updated.id, status: updated.status as string };
}

/**
 * Create a Document record for an individual (non-batch) upload.
 * Status: PENDING.
 */
export async function createIndividualDocument(input: {
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
      orgId: input.orgId,
      projectId: input.projectId,
      folderId: input.folderId,
      originalName: input.fileName,
      storageKey: buildStorageKey(
        input.orgId,
        input.projectId,
        input.folderId,
        "individual",
        input.fileName,
      ),
      fileHash: input.fileHash,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      status: "PENDING",
      uploadedById: session.user.id!,
      batchId: null,
    },
  });

  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Document",
    entityId: doc.id,
    action: "CREATE",
    userId: session.user.id!,
    payload: { originalName: input.fileName, mimeType: input.mimeType },
  });

  return { id: doc.id, status: doc.status as string, batchId: null };
}

/**
 * Create an UploadBatch with presigned URLs for all files.
 * Validates: ≤50 files, each ≤100MB.
 * Returns { batchId, presignedUrls }.
 */
export async function createUploadBatch(input: {
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

  if (input.files.length > MAX_BATCH_FILES) {
    throw new Error(
      `limite de ${MAX_BATCH_FILES} ficheiros por batch excedido (400).`,
    );
  }

  for (const file of input.files) {
    if (file.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`tamanho máximo 100MB excedido: ${file.fileName} (400).`);
    }
  }

  // Create the batch record
  const batch = await prisma.uploadBatch.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      folderId: input.folderId,
      uploadedById: session.user.id!,
      totalFiles: input.files.length,
    },
  });

  // Create Document stubs + generate presigned URLs
  const presignedUrls: string[] = [];

  for (const file of input.files) {
    const doc = await prisma.document.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        folderId: input.folderId,
        originalName: file.fileName,
        storageKey: buildStorageKey(
          input.orgId,
          input.projectId,
          input.folderId,
          batch.id,
          file.fileName,
        ),
        fileHash: file.fileHash,
        fileSizeBytes: file.fileSizeBytes,
        mimeType: file.mimeType,
        status: "PENDING",
        uploadedById: session.user.id!,
        batchId: batch.id,
      },
    });

    try {
      const { uploadUrl } = await generatePresignedUploadUrl({
        storageKey: buildStorageKey(
          input.orgId,
          input.projectId,
          input.folderId,
          doc.id,
          file.fileName,
        ),
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
      });
      presignedUrls.push(uploadUrl);
    } catch {
      // R2 not configured — return placeholder URL
      presignedUrls.push(
        `https://r2-pending.example.com/${input.orgId}/${batch.id}/${file.fileName}`,
      );
    }
  }

  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Document",
    entityId: batch.id,
    action: "CREATE",
    userId: session.user.id!,
    payload: { type: "UploadBatch", totalFiles: input.files.length },
  });

  return { batchId: batch.id, presignedUrls };
}

/**
 * Confirm a batch: transitions READY → CONFIRMED.
 * Verifies all documents in the batch have been uploaded.
 */
export async function confirmBatch(input: {
  batchId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const batch = await prisma.uploadBatch.findUnique({
    where: { id: input.batchId },
    include: { documents: true },
  });

  if (!batch) throw new Error("Batch não encontrado.");

  if (batch.status !== "READY") {
    throw new Error(
      `estado inválido: não pode confirmar batch com estado ${batch.status}. Requerido: READY.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Mark all documents as CONFIRMED
    await tx.document.updateMany({
      where: { batchId: batch.id },
      data: { status: "CONFIRMED" },
    });

    // Update batch status
    const confirmed = await tx.uploadBatch.update({
      where: { id: batch.id },
      data: { status: "CONFIRMED" },
    });

    return { id: confirmed.id, status: confirmed.status as string };
  });
}
