/**
 * Upload Pipeline tests — Sprint D2, Task D2-E3A (gov-1775110001-e3a)
 *
 * Testes (red phase TDD):
 *  - storageKey consistency: presign ↔ createIndividualDocument ↔ createUploadBatch
 *  - ACL/org membership checks: sem membership → 403, sem WRITE → 403, READ only → 403, ADMIN_ORG → permitido
 *  - Validações existentes: >100MB, mimeType inválido, >50 ficheiros, hash mismatch, Document PENDING
 *
 * NOTA: Testes de storageKey e ACL DEVEM FALHAR até D2-02 ser corrigido (red phase).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockDocumentUpdateMany = vi.hoisted(() => vi.fn());
const mockUploadBatchCreate = vi.hoisted(() => vi.fn());
const mockUploadBatchFindUnique = vi.hoisted(() => vi.fn());
const mockUploadBatchUpdate = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockFolderAclFindFirst = vi.hoisted(() => vi.fn());
const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      create: mockDocumentCreate,
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
      findMany: mockDocumentFindMany,
      updateMany: mockDocumentUpdateMany,
    },
    uploadBatch: {
      create: mockUploadBatchCreate,
      findUnique: mockUploadBatchFindUnique,
      update: mockUploadBatchUpdate,
    },
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    folderAcl: {
      findFirst: mockFolderAclFindFirst,
    },
    auditLog: {
      findFirst: mockAuditLogFindFirst.mockResolvedValue(null),
      create: mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" }),
    },
    $transaction: mockTransaction,
  },
}));

import {
  presignUpload,
  verifyUploadHash,
  createUploadBatch,
  confirmBatch,
  createIndividualDocument,
} from "@/lib/actions/upload-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const basePresignInput = {
  orgId: "org1",
  projectId: "proj1",
  folderId: "folder1",
  fileName: "planta-piso0.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 1024 * 1024,
};

// ─── 1. storageKey consistency (Issues 1+2 do QA) ────────────────────────────

describe("storageKey consistency (Issues 1+2 do QA)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    // ADMIN_ORG — sem restrições ACL
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "ADMIN_ORG",
    });
    mockFolderAclFindFirst.mockResolvedValue(null);
  });

  it("presignUpload retorna storageKey com padrão orgId/projectId/folderId/<docId>/fileName", async () => {
    const result = await presignUpload(basePresignInput);

    expect(result.key).toContain("org1");
    expect(result.key).toContain("proj1");
    expect(result.key).toContain("folder1");
    expect(result.key).toContain("planta-piso0.pdf");
    const parts = result.key.split("/");
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe("org1");
    expect(parts[1]).toBe("proj1");
    expect(parts[2]).toBe("folder1");
    expect(parts[4]).toBe("planta-piso0.pdf");
  });

  it("createIndividualDocument não usa literal 'individual' como segmento de docId no storageKey", async () => {
    // FALHA ESPERADA (red): implementação usa "individual" como docId fixo
    mockDocumentCreate.mockImplementation(
      (args: { data: { storageKey: string; id?: string } }) =>
        Promise.resolve({
          id: args.data.id ?? "doc-real-id",
          status: "PENDING",
          storageKey: args.data.storageKey,
          batchId: null,
        }),
    );

    await createIndividualDocument({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      fileName: "foto-obra.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 2 * 1024 * 1024,
      fileHash: "valid-sha256-hash",
    });

    const callArg = mockDocumentCreate.mock.calls[0][0];
    // storageKey não deve conter "/individual/" — deve usar um ID dinâmico
    expect(callArg.data.storageKey).not.toContain("/individual/");
    expect(callArg.data.storageKey).toMatch(
      /^org1\/proj1\/folder1\/[^/]+\/foto-obra\.jpg$/,
    );
  });

  it("createUploadBatch: storageKey nos Documents não deve usar batchId como segmento de docId", async () => {
    // FALHA ESPERADA (red): implementação usa batch.id como docId no storageKey do Document
    const batchId = "batch-abc";
    mockUploadBatchCreate.mockResolvedValue({
      id: batchId,
      status: "UPLOADING",
      totalFiles: 1,
    });
    mockDocumentCreate.mockImplementation(
      (args: { data: { storageKey: string } }) =>
        Promise.resolve({
          id: "doc-batch-1",
          storageKey: args.data.storageKey,
          status: "PENDING",
        }),
    );

    await createUploadBatch({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      files: [
        {
          fileName: "planta.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 500 * 1024,
          fileHash: "hash-1",
        },
      ],
    });

    const callArg = mockDocumentCreate.mock.calls[0][0];
    const docStorageKey: string = callArg.data.storageKey;

    // storageKey do Document deve usar docId gerado (doc.id), não batchId
    expect(docStorageKey).not.toMatch(
      new RegExp(`^org1/proj1/folder1/${batchId}/`),
    );
  });

  it("createUploadBatch: presigned URL deve referenciar o mesmo key que Document.storageKey", async () => {
    // FALHA ESPERADA (red): presigned URL usa doc.id, Document.storageKey usa batch.id — mismatch
    const batchId = "batch-xyz";
    const docId = "doc-real-id";
    mockUploadBatchCreate.mockResolvedValue({
      id: batchId,
      status: "UPLOADING",
      totalFiles: 1,
    });
    mockDocumentCreate.mockResolvedValue({
      id: docId,
      storageKey: `org1/proj1/folder1/${batchId}/relatorio.pdf`, // storageKey usa batchId (bug)
      status: "PENDING",
    });

    const result = await createUploadBatch({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      files: [
        {
          fileName: "relatorio.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 300 * 1024,
          fileHash: "hash-2",
        },
      ],
    });

    const callArg = mockDocumentCreate.mock.calls[0][0];
    const docStorageKey: string = callArg.data.storageKey;
    const presignedUrl: string = result.presignedUrls[0];

    // O key no presigned URL deve coincidir com o storageKey guardado no Document
    // Quando ambos usam doc.id, o presignedUrl vai conter o mesmo path que o storageKey
    expect(presignedUrl).toContain(docStorageKey.split("/")[3]); // segmento docId deve ser igual
  });
});

// ─── 2. ACL / org membership checks (Issues 3+4 do QA) ──────────────────────

describe("ACL e org membership checks (Issues 3+4 do QA)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("presignUpload com utilizador sem OrgMembership → deve rejeitar com 403", async () => {
    // FALHA ESPERADA (red): implementação não verifica OrgMembership
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(presignUpload(basePresignInput)).rejects.toThrow(
      /403|proibido|sem permissão|não é membro|Forbidden/i,
    );
  });

  it("presignUpload com utilizador TECNICO sem FolderAcl → deve rejeitar com 403", async () => {
    // FALHA ESPERADA (red): implementação não verifica FolderAcl
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "TECNICO",
    });
    mockFolderAclFindFirst.mockResolvedValue(null); // sem ACL explícita

    await expect(presignUpload(basePresignInput)).rejects.toThrow(
      /403|proibido|sem permissão|WRITE|Forbidden/i,
    );
  });

  it("presignUpload com utilizador com FolderAcl READ (sem WRITE) → deve rejeitar com 403", async () => {
    // FALHA ESPERADA (red): implementação não verifica permissões do FolderAcl
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "TECNICO",
    });
    mockFolderAclFindFirst.mockResolvedValue({
      id: "acl1",
      userId: "u1",
      folderId: "folder1",
      permissions: ["READ"], // READ sem WRITE
    });

    await expect(presignUpload(basePresignInput)).rejects.toThrow(
      /403|proibido|sem permissão|WRITE|Forbidden/i,
    );
  });

  it("presignUpload com utilizador ADMIN_ORG (sem FolderAcl explícito) → deve ser permitido", async () => {
    // ADMIN_ORG bypassa verificação de FolderAcl — deve ser sempre permitido
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "ADMIN_ORG",
    });
    mockFolderAclFindFirst.mockResolvedValue(null);

    const result = await presignUpload(basePresignInput);

    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("uploadUrl");
    expect(result.uploadUrl).toMatch(/^https?:\/\//);
  });
});

// ─── 3. Validações de ficheiro ────────────────────────────────────────────────

describe("presignUpload — validações de ficheiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "ADMIN_ORG",
    });
    mockFolderAclFindFirst.mockResolvedValue(null);
  });

  it("deve rejeitar ficheiro maior que 100MB → erro 400", async () => {
    await expect(
      presignUpload({ ...basePresignInput, fileSizeBytes: 101 * 1024 * 1024 }),
    ).rejects.toThrow(/tamanho|100MB|400/i);
  });

  it("deve rejeitar mimeType inválido → erro 400", async () => {
    await expect(
      presignUpload({
        ...basePresignInput,
        mimeType: "application/x-unknown-binary",
        fileName: "arquivo.bin",
      }),
    ).rejects.toThrow(/mimeType|400|aceite/i);
  });
});

// ─── 4. createUploadBatch — validações de batch ───────────────────────────────

describe("createUploadBatch — validações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "ADMIN_ORG",
    });
    mockFolderAclFindFirst.mockResolvedValue(null);
  });

  it("deve rejeitar batch com mais de 50 ficheiros → 400", async () => {
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
    const files = [
      {
        fileName: "enorme.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 101 * 1024 * 1024,
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
});

// ─── 5. verifyUploadHash ──────────────────────────────────────────────────────

describe("verifyUploadHash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("deve rejeitar hash mismatch (SHA-256 errado) → erro com 400/hash/inválido", async () => {
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
});

// ─── 6. createIndividualDocument ─────────────────────────────────────────────

describe("createIndividualDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "ADMIN_ORG",
    });
    mockFolderAclFindFirst.mockResolvedValue(null);
  });

  it("deve criar Document com status PENDING para upload individual", async () => {
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

// ─── 7. confirmBatch ─────────────────────────────────────────────────────────

describe("confirmBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("deve confirmar batch em estado READY → CONFIRMED", async () => {
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
    mockUploadBatchFindUnique.mockResolvedValue({
      id: "batch1",
      orgId: "org1",
      status: "UPLOADING",
      totalFiles: 5,
      processedFiles: 3,
    });

    await expect(confirmBatch({ batchId: "batch1" })).rejects.toThrow(
      /estado|READY|não pode/i,
    );
  });
});
