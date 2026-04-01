/**
 * CDE CRUD tests — Sprint D2, Task D2-T02
 * Task: gov-1775041180765-0yiwrq
 *
 * Testes (red phase TDD — features ainda não implementadas):
 *  - CRUD CdeFolder: criar root, sub-pasta, listar por projecto
 *  - FolderAcl: WRITE pode upload, READ não pode upload
 *  - Document versionamento: v2 sobe → v1 fica SUPERSEDED
 *  - Document status transitions válidas e inválidas
 *  - Listar documentos por pasta com paginação
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockCdeFolderCreate = vi.hoisted(() => vi.fn());
const mockCdeFolderFindMany = vi.hoisted(() => vi.fn());
const mockCdeFolderFindUnique = vi.hoisted(() => vi.fn());
const mockFolderAclFindFirst = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cdeFolder: {
      create: mockCdeFolderCreate,
      findMany: mockCdeFolderFindMany,
      findUnique: mockCdeFolderFindUnique,
    },
    folderAcl: {
      findFirst: mockFolderAclFindFirst,
    },
    document: {
      create: mockDocumentCreate,
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
      findMany: mockDocumentFindMany,
    },
    $transaction: mockTransaction,
  },
}));

// Importar funções a testar (não existem ainda — red phase)
import {
  createCdeFolder,
  listCdeFolders,
  checkFolderPermission,
  createDocumentVersion,
  transitionDocumentStatus,
  listDocumentsByFolder,
} from "@/lib/actions/cde-actions";

describe("createCdeFolder — CRUD pastas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve criar pasta root (parentId null) num projecto", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockCdeFolderCreate.mockResolvedValue({
      id: "folder-root",
      name: "Documentação Técnica",
      parentId: null,
      path: "/org1/proj1/folder-root",
    });

    const result = await createCdeFolder({
      orgId: "org1",
      projectId: "proj1",
      name: "Documentação Técnica",
      parentId: null,
    });

    expect(result.parentId).toBeNull();
    expect(result.name).toBe("Documentação Técnica");
    expect(mockCdeFolderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: null,
          orgId: "org1",
          projectId: "proj1",
        }),
      }),
    );
  });

  it("deve criar sub-pasta com parentId preenchido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockCdeFolderFindUnique.mockResolvedValue({
      id: "folder-parent",
      orgId: "org1",
      projectId: "proj1",
      path: "/org1/proj1/folder-parent",
    });
    mockCdeFolderCreate.mockResolvedValue({
      id: "folder-child",
      name: "Plantas",
      parentId: "folder-parent",
      path: "/org1/proj1/folder-parent/folder-child",
    });

    const result = await createCdeFolder({
      orgId: "org1",
      projectId: "proj1",
      name: "Plantas",
      parentId: "folder-parent",
    });

    expect(result.parentId).toBe("folder-parent");
    expect(result.path).toContain("folder-parent");
  });

  it("deve listar pastas por projecto (apenas do projecto correcto)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockCdeFolderFindMany.mockResolvedValue([
      { id: "f1", name: "Pasta A", projectId: "proj1" },
      { id: "f2", name: "Pasta B", projectId: "proj1" },
    ]);

    const result = await listCdeFolders({ orgId: "org1", projectId: "proj1" });

    expect(result).toHaveLength(2);
    expect(
      result.every((f: { projectId: string }) => f.projectId === "proj1"),
    ).toBe(true);
    expect(mockCdeFolderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "proj1", orgId: "org1" }),
      }),
    );
  });
});

describe("checkFolderPermission — FolderAcl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve permitir upload para user com permissão WRITE na pasta", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFolderAclFindFirst.mockResolvedValue({
      id: "acl1",
      folderId: "folder1",
      userId: "u1",
      permissions: ["READ", "WRITE"],
    });

    const hasPermission = await checkFolderPermission({
      userId: "u1",
      folderId: "folder1",
      requiredPermission: "WRITE",
    });

    expect(hasPermission).toBe(true);
  });

  it("deve negar upload para user com apenas permissão READ na pasta", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockFolderAclFindFirst.mockResolvedValue({
      id: "acl2",
      folderId: "folder1",
      userId: "u2",
      permissions: ["READ"], // apenas READ, sem WRITE
    });

    const hasPermission = await checkFolderPermission({
      userId: "u2",
      folderId: "folder1",
      requiredPermission: "WRITE",
    });

    expect(hasPermission).toBe(false);
  });

  it("deve negar acesso quando não existe ACL para o user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3" } });
    mockFolderAclFindFirst.mockResolvedValue(null); // sem ACL

    const hasPermission = await checkFolderPermission({
      userId: "u3",
      folderId: "folder1",
      requiredPermission: "READ",
    });

    expect(hasPermission).toBe(false);
  });
});

describe("createDocumentVersion — versionamento", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve marcar v1 como SUPERSEDED quando se faz upload de v2 do mesmo documento", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });

    // v1 já existe
    const existingDocV1 = {
      id: "doc-v1",
      originalName: "planta-piso0.pdf",
      status: "CONFIRMED",
      revision: "A",
      folderId: "folder1",
      orgId: "org1",
      projectId: "proj1",
    };
    mockDocumentFindMany.mockResolvedValue([existingDocV1]);

    // Simular transação: update v1 → SUPERSEDED, create v2
    mockTransaction.mockImplementation(
      async (
        fn: (tx: {
          document: {
            update: typeof mockDocumentUpdate;
            create: typeof mockDocumentCreate;
          };
        }) => Promise<unknown>,
      ) => {
        return fn({
          document: {
            update: mockDocumentUpdate,
            create: mockDocumentCreate,
          },
        });
      },
    );
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-v1",
      status: "SUPERSEDED",
    });
    mockDocumentCreate.mockResolvedValue({
      id: "doc-v2",
      originalName: "planta-piso0.pdf",
      status: "PENDING",
      revision: "B",
    });

    const result = await createDocumentVersion({
      orgId: "org1",
      projectId: "proj1",
      folderId: "folder1",
      originalName: "planta-piso0.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024 * 1024,
      fileHash: "new-hash-v2",
      revision: "B",
    });

    expect(result.revision).toBe("B");
    // Verificar que v1 foi marcado SUPERSEDED
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUPERSEDED" }),
      }),
    );
  });
});

describe("transitionDocumentStatus — transições de estado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve permitir transição PENDING → NORMALIZING", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc1",
      status: "PENDING",
      orgId: "org1",
    });
    mockDocumentUpdate.mockResolvedValue({ id: "doc1", status: "NORMALIZING" });

    const result = await transitionDocumentStatus({
      documentId: "doc1",
      toStatus: "NORMALIZING",
    });

    expect(result.status).toBe("NORMALIZING");
  });

  it("deve permitir transição NORMALIZING → READY", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc1",
      status: "NORMALIZING",
      orgId: "org1",
    });
    mockDocumentUpdate.mockResolvedValue({ id: "doc1", status: "READY" });

    const result = await transitionDocumentStatus({
      documentId: "doc1",
      toStatus: "READY",
    });

    expect(result.status).toBe("READY");
  });

  it("deve permitir transição READY → CONFIRMED", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc1",
      status: "READY",
      orgId: "org1",
    });
    mockDocumentUpdate.mockResolvedValue({ id: "doc1", status: "CONFIRMED" });

    const result = await transitionDocumentStatus({
      documentId: "doc1",
      toStatus: "CONFIRMED",
    });

    expect(result.status).toBe("CONFIRMED");
  });

  it("deve rejeitar transição inválida: CONFIRMED → PENDING", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc1",
      status: "CONFIRMED",
      orgId: "org1",
    });

    await expect(
      transitionDocumentStatus({
        documentId: "doc1",
        toStatus: "PENDING",
      }),
    ).rejects.toThrow(/transição|inválida|CONFIRMED/i);
  });
});

describe("listDocumentsByFolder — paginação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve listar documentos por pasta com paginação (limit + offset)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindMany.mockResolvedValue([
      { id: "doc1", originalName: "doc1.pdf", folderId: "folder1" },
      { id: "doc2", originalName: "doc2.pdf", folderId: "folder1" },
    ]);

    const result = await listDocumentsByFolder({
      orgId: "org1",
      folderId: "folder1",
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(2);
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 0,
        where: expect.objectContaining({
          folderId: "folder1",
          orgId: "org1",
        }),
      }),
    );
  });

  it("deve aplicar offset correcto para segunda página", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDocumentFindMany.mockResolvedValue([
      { id: "doc11", originalName: "doc11.pdf", folderId: "folder1" },
    ]);

    await listDocumentsByFolder({
      orgId: "org1",
      folderId: "folder1",
      limit: 10,
      offset: 10,
    });

    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10 }),
    );
  });
});
