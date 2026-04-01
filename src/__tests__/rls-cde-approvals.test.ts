/**
 * RLS Isolation tests — Sprint D2, Task D2-T05
 * Task: gov-1775041180765-0yiwrq
 *
 * Testes (red phase TDD — features ainda não implementadas):
 *  - Org A cria Document → Org B não consegue ler (empty)
 *  - Org A cria CdeFolder → Org B não consegue listar
 *  - Org A cria Approval → Org B não consegue aprovar/rejeitar
 *  - User Org A com role FISCAL não vê dados de Org B mesmo com projectId válido
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuthOrgA = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockCdeFolderFindMany = vi.hoisted(() => vi.fn());
const mockApprovalFindUnique = vi.hoisted(() => vi.fn());
const mockApprovalUpdate = vi.hoisted(() => vi.fn());
const mockFolderAclFindFirst = vi.hoisted(() => vi.fn());
const mockProjectMembershipFindFirst = vi.hoisted(() => vi.fn());
const mockStampCreate = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuthOrgA }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: mockDocumentFindUnique,
      findMany: mockDocumentFindMany,
    },
    cdeFolder: {
      findMany: mockCdeFolderFindMany,
    },
    approval: {
      findUnique: mockApprovalFindUnique,
      update: mockApprovalUpdate,
    },
    folderAcl: {
      findFirst: mockFolderAclFindFirst,
    },
    projectMembership: {
      findFirst: mockProjectMembershipFindFirst,
    },
    stamp: {
      create: mockStampCreate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
    $transaction: mockTransaction,
  },
}));

// Importar funções a testar (não existem ainda — red phase)
import {
  getDocument,
  listCdeFolders,
  approveDocument,
  listDocumentsByFolder,
} from "@/lib/actions/rls-guards";

// ─── Constantes de fixture ──────────────────────────────────────────────────
const ORG_A = "org-a-id";
const ORG_B = "org-b-id";
const USER_ORG_A = "user-in-org-a";
const USER_ORG_B = "user-in-org-b";
const USER_FISCAL_ORG_A = "fiscal-user-org-a";
const DOC_ORG_A = "doc-belongs-to-org-a";
const FOLDER_ORG_A = "folder-belongs-to-org-a";
const APPROVAL_ORG_A = "approval-belongs-to-org-a";
const PROJECT_ORG_A = "project-belongs-to-org-a";

describe("RLS — Document isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Org B não consegue ler Document criado por Org A (query retorna null)", async () => {
    // User de Org B tenta aceder a documento de Org A
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_B } });

    // RLS: query com orgId de Org B não encontra doc de Org A
    mockDocumentFindUnique.mockResolvedValue(null);

    const result = await getDocument({
      documentId: DOC_ORG_A,
      orgId: ORG_B, // Org B não deve ver docs da Org A
    });

    expect(result).toBeNull();
    // Verificar que a query inclui orgId no filtro (fundamental para RLS)
    expect(mockDocumentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: DOC_ORG_A,
          orgId: ORG_B, // sempre filtrar por orgId
        }),
      }),
    );
  });

  it("Org A consegue ler o seu próprio Document", async () => {
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_A } });
    mockDocumentFindUnique.mockResolvedValue({
      id: DOC_ORG_A,
      orgId: ORG_A,
      status: "CONFIRMED",
    });

    const result = await getDocument({
      documentId: DOC_ORG_A,
      orgId: ORG_A,
    });

    expect(result).not.toBeNull();
    expect(result?.orgId).toBe(ORG_A);
  });

  it("Org B obtém lista vazia ao listar documentos de pasta da Org A", async () => {
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_B } });

    // RLS: query com orgId=ORG_B nunca devolve docs com orgId=ORG_A
    mockDocumentFindMany.mockResolvedValue([]);

    const result = await listDocumentsByFolder({
      folderId: FOLDER_ORG_A,
      orgId: ORG_B,
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(0);
  });
});

describe("RLS — CdeFolder isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Org B não consegue listar CdeFolders criados por Org A", async () => {
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_B } });

    // RLS: query com orgId=ORG_B retorna empty
    mockCdeFolderFindMany.mockResolvedValue([]);

    const result = await listCdeFolders({
      orgId: ORG_B,
      projectId: PROJECT_ORG_A, // mesmo que passem projectId válido de Org A
    });

    expect(result).toHaveLength(0);
    expect(mockCdeFolderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: ORG_B, // filtro obrigatório por orgId
        }),
      }),
    );
  });
});

describe("RLS — Approval isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Org B não consegue aprovar Approval criado por Org A", async () => {
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_B } });

    // RLS: buscar approval com orgId=ORG_B não encontra approval de ORG_A
    mockApprovalFindUnique.mockResolvedValue(null);

    await expect(
      approveDocument({
        approvalId: APPROVAL_ORG_A,
        orgId: ORG_B,
      }),
    ).rejects.toThrow(/não encontrado|404|permissão/i);
  });

  it("Org B não consegue rejeitar Approval de Org A", async () => {
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_B } });

    // RLS: query com orgId=ORG_B não devolve approval de ORG_A
    mockApprovalFindUnique.mockResolvedValue(null);

    // Importar rejectApproval do módulo rls-guards
    const { rejectApproval } = await import("@/lib/actions/rls-guards");

    await expect(
      rejectApproval({
        approvalId: APPROVAL_ORG_A,
        orgId: ORG_B,
        note: "Tentativa de rejeição cross-org",
      }),
    ).rejects.toThrow(/não encontrado|404|permissão/i);
  });
});

describe("RLS — FISCAL user isolation entre orgs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("User FISCAL da Org A não vê Documents de Org B mesmo com projectId válido de Org A", async () => {
    // FISCAL de Org A tenta listar docs passando projectId de Org A mas folderId de Org B
    mockAuthOrgA.mockResolvedValue({
      user: { id: USER_FISCAL_ORG_A },
    });

    // Simular que user é FISCAL de Org A (membership existe em Org A)
    mockProjectMembershipFindFirst.mockImplementation(
      (args: { where: { orgId: string } }) => {
        if (args.where.orgId === ORG_A) {
          return Promise.resolve({ role: "FISCAL", orgId: ORG_A });
        }
        return Promise.resolve(null); // sem membership em Org B
      },
    );

    // RLS: query filtra por orgId — docs de ORG_B nunca aparecem
    mockDocumentFindMany.mockResolvedValue([]);

    const result = await listDocumentsByFolder({
      folderId: FOLDER_ORG_A,
      orgId: ORG_A, // usa orgId correcto de Org A
      limit: 10,
      offset: 0,
    });

    // Mesmo sendo FISCAL de Org A, não deve ver docs de Org B
    // (query sempre filtra por orgId, que é ORG_A)
    expect(result).toHaveLength(0);
  });

  it("User FISCAL da Org A consegue ver Documents da sua própria org", async () => {
    mockAuthOrgA.mockResolvedValue({
      user: { id: USER_FISCAL_ORG_A },
    });
    mockProjectMembershipFindFirst.mockResolvedValue({
      role: "FISCAL",
      orgId: ORG_A,
    });
    mockDocumentFindMany.mockResolvedValue([
      { id: "doc1", orgId: ORG_A, status: "CONFIRMED" },
      { id: "doc2", orgId: ORG_A, status: "READY" },
    ]);

    const result = await listDocumentsByFolder({
      folderId: FOLDER_ORG_A,
      orgId: ORG_A,
      limit: 10,
      offset: 0,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((d: { orgId: string }) => d.orgId === ORG_A)).toBe(
      true,
    );
  });

  it("Query de Document sempre inclui orgId no WHERE (RLS enforcement)", async () => {
    mockAuthOrgA.mockResolvedValue({ user: { id: USER_ORG_A } });
    mockDocumentFindUnique.mockResolvedValue(null);

    await getDocument({ documentId: DOC_ORG_A, orgId: ORG_A });

    // Garantir que orgId está SEMPRE no filtro — nunca buscar sem orgId
    expect(mockDocumentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: expect.any(String), // orgId obrigatório
        }),
      }),
    );
  });
});

describe("RLS — User sem sessão → não autenticado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDocument sem sessão → lança erro de autenticação", async () => {
    // Simular user sem sessão (auth retorna null)
    mockAuthOrgA.mockResolvedValue(null);

    await expect(
      getDocument({ documentId: DOC_ORG_A, orgId: ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("listCdeFolders sem sessão → lança erro de autenticação", async () => {
    mockAuthOrgA.mockResolvedValue(null);

    await expect(
      listCdeFolders({ orgId: ORG_A, projectId: PROJECT_ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("approveDocument sem sessão → lança erro de autenticação", async () => {
    mockAuthOrgA.mockResolvedValue(null);

    await expect(
      approveDocument({ approvalId: APPROVAL_ORG_A, orgId: ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("listDocumentsByFolder sem sessão → lança erro de autenticação", async () => {
    mockAuthOrgA.mockResolvedValue(null);

    await expect(
      listDocumentsByFolder({
        folderId: FOLDER_ORG_A,
        orgId: ORG_A,
        limit: 10,
        offset: 0,
      }),
    ).rejects.toThrow("Não autenticado.");
  });
});
