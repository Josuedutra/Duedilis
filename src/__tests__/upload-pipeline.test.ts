/**
 * Upload Pipeline tests — Sprint D2, Task D2-T01
 * Task: gov-1775041180765-0yiwrq
 *
 * Testes (red phase TDD — features ainda não implementadas):
 *  - presign retorna URL R2 válida com campos obrigatórios
 *  - Upload com fileHash inválido → rejeitado com 400
 *  - Batch com >50 ficheiros → rejeitado com 400
 *  - Batch com ficheiro >100MB → rejeitado com 400
 *  - Upload individual cria Document com status PENDING
 *  - Batch flow completo: criar → upload → confirmar → CONFIRMED
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockUploadBatchCreate = vi.hoisted(() => vi.fn());
const mockUploadBatchFindUnique = vi.hoisted(() => vi.fn());
const mockUploadBatchUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      create: mockDocumentCreate,
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
      findMany: mockDocumentFindMany,
    },
    uploadBatch: {
      create: mockUploadBatchCreate,
      findUnique: mockUploadBatchFindUnique,
      update: mockUploadBatchUpdate,
    },
    $transaction: mockTransaction,
  },
}));

// Importar funções a testar (não existem ainda — red phase)
import {
  presignUpload,
  verifyUploadHash,
  createUploadBatch,
  confirmBatch,
  createIndividualDocument,
} from "@/lib/actions/upload-actions";

describe("presignUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar URL R2 válida com campos obrigatórios", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });

    const result = await presignUpload({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "planta-piso0.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024 * 1024, // 1MB
    });

    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("uploadUrl");
    expect(result).toHaveProperty("expiresAt");
    expect(typeof result.uploadUrl).toBe("string");
    expect(result.uploadUrl).toMatch(/^https?:\/\//);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("deve rejeitar quando utilizador não está autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      presignUpload({
        orgId: "org1",
        projectId: "proj1",
        folderId: "folder1",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024,
      }),
    ).rejects.toThrow();
  });

  it("deve incluir orgId e projectId no storage key retornado", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });

    const result = await presignUpload({
      orgId: "org-abc",
      projectId: "proj-xyz",
      folderId: "folder1",
      fileName: "relatorio.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSizeBytes: 512 * 1024,
    });

    expect(result.key).toContain("org-abc");
    expect(result.key).toContain("proj-xyz");
  });
});

describe("verifyUploadHash", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve rejeitar upload com fileHash inválido (SHA-256 mismatch) → 400", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc1",
      fileHash: "correct-hash-abc123",
      orgId: "org1",
    });

    await expect(
      verifyUploadHash({
        documentId: "doc1",
        receivedHash: "wrong-hash-xyz999",
      }),
    ).rejects.toThrow(/hash|400|inválido/i);
  });

  it("deve aceitar upload quando fileHash coincide", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const correctHash =
      "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc1",
      fileHash: correctHash,
      orgId: "org1",
    });
    mockDocumentUpdate.mockResolvedValue({ id: "doc1", status: "NORMALIZING" });

    const result = await verifyUploadHash({
      documentId: "doc1",
      receivedHash: correctHash,
    });

    expect(result.status).toBe("NORMALIZING");
  });
});

describe("createUploadBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve rejeitar batch com mais de 50 ficheiros → 400", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });

    const files = Array.from({ length: 51 }, (_, i) => ({
      fileName: `file-${i}.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      fileHash: `hash-${i}`,
    }));

    await expect(
      createUploadBatch({
        orgId: "org1",
        projectId: "proj1",
        folderId: "folder1",
        files,
      }),
    ).rejects.toThrow(/limite|50|400/i);
  });

  it("deve rejeitar batch com ficheiro maior que 100MB → 400", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });

    const files = [
      {
        fileName: "enorme.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 101 * 1024 * 1024, // 101MB — acima do limite
        fileHash: "hash-abc",
      },
    ];

    await expect(
      createUploadBatch({
        orgId: "org1",
        projectId: "proj1",
        folderId: "folder1",
        files,
      }),
    ).rejects.toThrow(/tamanho|100MB|400/i);
  });

  it("deve criar batch com ficheiros válidos e retornar id + presigned URLs", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockUploadBatchCreate.mockResolvedValue({
      id: "batch1",
      status: "UPLOADING",
      totalFiles: 3,
    });
    mockDocumentCreate.mockResolvedValue({ id: "doc-new" });

    const files = Array.from({ length: 3 }, (_, i) => ({
      fileName: `planta-${i}.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: 500 * 1024, // 500KB cada
      fileHash: `valid-hash-${i}`,
    }));

    const result = await createUploadBatch({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      files,
    });

    expect(result).toHaveProperty("batchId");
    expect(result).toHaveProperty("presignedUrls");
    expect(Array.isArray(result.presignedUrls)).toBe(true);
  });
});

describe("createIndividualDocument", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve criar Document com status PENDING para upload individual", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentCreate.mockResolvedValue({
      id: "doc-individual-1",
      status: "PENDING",
      originalName: "foto-obra.jpg",
      batchId: null,
    });

    const result = await createIndividualDocument({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "foto-obra.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 2 * 1024 * 1024,
      fileHash: "valid-sha256-hash",
    });

    expect(result.status).toBe("PENDING");
    expect(result.batchId).toBeNull();
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          batchId: null,
        }),
      }),
    );
  });
});

describe("confirmBatch — batch flow completo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve confirmar batch: UPLOADING → CONFIRMED quando todos os docs confirmados", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockUploadBatchFindUnique.mockResolvedValue({
      id: "batch1",
      orgId: "org1",
      status: "READY",
      totalFiles: 2,
      processedFiles: 2,
      documents: [
        { id: "doc1", status: "READY" },
        { id: "doc2", status: "READY" },
      ],
    });
    mockTransaction.mockResolvedValue({ id: "batch1", status: "CONFIRMED" });

    const result = await confirmBatch({ batchId: "batch1" });

    expect(result.status).toBe("CONFIRMED");
  });

  it("deve rejeitar confirmação de batch que não está em estado READY", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockUploadBatchFindUnique.mockResolvedValue({
      id: "batch1",
      orgId: "org1",
      status: "UPLOADING", // ainda a fazer upload
      totalFiles: 5,
      processedFiles: 3,
    });

    await expect(confirmBatch({ batchId: "batch1" })).rejects.toThrow(
      /estado|READY|não pode/i,
    );
  });
});
