/**
 * Changes Frontend Tests — Sprint D4, Task D4-E3-12
 * gov-1775311333434-jtb0ml
 *
 * Testes para as páginas /changes:
 *  1. List — renderiza lista de ChangeRecords com status badge, financialImpact
 *  2. Detail — mostra lifecycle, comments, linked documents
 *  3. Create form — validação de campos obrigatórios (title, description, type)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockChangeRecordFindMany = vi.hoisted(() => vi.fn());
const mockChangeRecordFindUnique = vi.hoisted(() => vi.fn());
const mockChangeRecordCreate = vi.hoisted(() => vi.fn());
const mockChangeRecordUpdate = vi.hoisted(() => vi.fn());

const mockChangeCommentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    changeRecord: {
      findMany: mockChangeRecordFindMany,
      findUnique: mockChangeRecordFindUnique,
      create: mockChangeRecordCreate,
      update: mockChangeRecordUpdate,
    },
    changeComment: {
      create: mockChangeCommentCreate,
    },
  },
}));

import {
  listChanges,
  getChangeDetail,
  createChange,
  addChangeComment,
  transitionChange,
} from "@/lib/actions/change-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-test-001";
const PROJECT_ID = "proj-test-001";
const CHANGE_ID = "change-001";

const baseChange = {
  id: CHANGE_ID,
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  title: "Mudança de escopo — Piso 3",
  description: "Adição de 200m² ao piso 3 conforme pedido do cliente.",
  type: "SCOPE",
  status: "DRAFT",
  financialImpact: 45000,
  createdAt: new Date("2026-04-04T09:00:00Z"),
  updatedAt: new Date("2026-04-04T09:00:00Z"),
  author: { id: "user-1", name: "Ana Costa", email: "ana@test.com" },
};

const baseComment = {
  id: "comment-001",
  changeId: CHANGE_ID,
  authorId: "user-1",
  body: "Confirmar impacto financeiro com o gestor de custos.",
  createdAt: new Date("2026-04-04T10:00:00Z"),
  author: { id: "user-1", name: "Ana Costa" },
};

const baseLinkedDoc = {
  id: "link-001",
  changeId: CHANGE_ID,
  documentId: "doc-001",
  document: {
    id: "doc-001",
    originalName: "planta-piso3-rev02.pdf",
    status: "CONFIRMED",
  },
};

const baseChangeWithRelations = {
  ...baseChange,
  comments: [baseComment],
  linkedDocuments: [baseLinkedDoc],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Changes List — renderiza lista com status badge, financialImpact
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: listChanges — changes list page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("retorna lista de ChangeRecords com status e financialImpact", async () => {
    const changes = [
      baseChange,
      {
        ...baseChange,
        id: "change-002",
        title: "Alteração de materiais",
        type: "COST",
        status: "UNDER_REVIEW",
        financialImpact: 12000,
      },
    ];
    mockChangeRecordFindMany.mockResolvedValue(changes);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("DRAFT");
    expect(result[0].financialImpact).toBe(45000);
    expect(result[1].status).toBe("UNDER_REVIEW");
    expect(result[1].financialImpact).toBe(12000);
    expect(mockChangeRecordFindMany).toHaveBeenCalledTimes(1);
  });

  it("lista vazia quando não há mudanças no projecto", async () => {
    mockChangeRecordFindMany.mockResolvedValue([]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("retorna ChangeRecords com dados do author", async () => {
    mockChangeRecordFindMany.mockResolvedValue([baseChange]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result[0].author.name).toBe("Ana Costa");
    expect(result[0].author.email).toBe("ana@test.com");
  });

  it("utilizador sem membership → rejeitar", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      listChanges({ orgId: ORG_ID, projectId: PROJECT_ID }),
    ).rejects.toThrow(/unauthorized|forbidden|403|sem permissão/i);

    expect(mockChangeRecordFindMany).not.toHaveBeenCalled();
  });

  it("change com financialImpact nulo → listado normalmente", async () => {
    const changeNoImpact = { ...baseChange, financialImpact: null };
    mockChangeRecordFindMany.mockResolvedValue([changeNoImpact]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result[0].financialImpact).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Change Detail — lifecycle, comments, linked documents
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: getChangeDetail — change detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("retorna change com comments e linkedDocuments", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(baseChangeWithRelations);

    const result = await getChangeDetail({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
    });

    expect(result.id).toBe(CHANGE_ID);
    expect(result.status).toBe("DRAFT");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].body).toBe(
      "Confirmar impacto financeiro com o gestor de custos.",
    );
    expect(result.linkedDocuments).toHaveLength(1);
    expect(result.linkedDocuments[0].document.originalName).toBe(
      "planta-piso3-rev02.pdf",
    );
  });

  it("change com múltiplos comentários — todos retornados", async () => {
    const change = {
      ...baseChangeWithRelations,
      comments: [
        baseComment,
        {
          ...baseComment,
          id: "comment-002",
          body: "Aprovado pelo gestor.",
          createdAt: new Date("2026-04-04T11:00:00Z"),
        },
      ],
    };
    mockChangeRecordFindUnique.mockResolvedValue(change);

    const result = await getChangeDetail({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
    });

    expect(result.comments).toHaveLength(2);
  });

  it("change sem documentos linked → linkedDocuments vazio", async () => {
    const changeNoLinks = {
      ...baseChangeWithRelations,
      linkedDocuments: [],
    };
    mockChangeRecordFindUnique.mockResolvedValue(changeNoLinks);

    const result = await getChangeDetail({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
    });

    expect(result.linkedDocuments).toHaveLength(0);
  });

  it("change não encontrado → lança 404", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(null);

    await expect(
      getChangeDetail({ orgId: ORG_ID, changeId: "nao-existe" }),
    ).rejects.toThrow(/not found|404|não encontrado/i);
  });

  it("lifecycle: status DRAFT → OPEN via transitionChange", async () => {
    const openChange = { ...baseChange, status: "OPEN" };
    mockChangeRecordFindUnique.mockResolvedValue(baseChange);
    mockChangeRecordUpdate.mockResolvedValue(openChange);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
      toStatus: "OPEN",
    });

    expect(result.status).toBe("OPEN");
    expect(mockChangeRecordUpdate).toHaveBeenCalledTimes(1);
  });

  it("lifecycle: status OPEN → UNDER_REVIEW via transitionChange", async () => {
    mockChangeRecordFindUnique.mockResolvedValue({
      ...baseChange,
      status: "OPEN",
    });
    mockChangeRecordUpdate.mockResolvedValue({
      ...baseChange,
      status: "UNDER_REVIEW",
    });

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
      toStatus: "UNDER_REVIEW",
    });

    expect(result.status).toBe("UNDER_REVIEW");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create Change Form — validação de campos obrigatórios
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: createChange — create change form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("cria ChangeRecord com todos os campos obrigatórios → status=DRAFT", async () => {
    mockChangeRecordCreate.mockResolvedValue(baseChange);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Mudança de escopo — Piso 3",
      description: "Adição de 200m² ao piso 3 conforme pedido do cliente.",
      type: "SCOPE",
    });

    expect(result.status).toBe("DRAFT");
    expect(result.title).toBe("Mudança de escopo — Piso 3");
    expect(mockChangeRecordCreate).toHaveBeenCalledTimes(1);
  });

  it("cria ChangeRecord com financialImpact opcional", async () => {
    const changeWithImpact = { ...baseChange, financialImpact: 45000 };
    mockChangeRecordCreate.mockResolvedValue(changeWithImpact);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Mudança de escopo — Piso 3",
      description: "Adição de 200m².",
      type: "SCOPE",
      financialImpact: 45000,
    });

    expect(result.financialImpact).toBe(45000);
  });

  it("title vazio → lança erro de validação", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "",
        description: "Descrição válida",
        type: "SCOPE",
      }),
    ).rejects.toThrow(/title.*required|obrigatório/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });

  it("title só com espaços → lança erro de validação", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "   ",
        description: "Descrição válida",
        type: "SCOPE",
      }),
    ).rejects.toThrow(/title.*required|obrigatório/i);
  });

  it("description vazia → lança erro de validação", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "Título válido",
        description: "",
        type: "SCOPE",
      }),
    ).rejects.toThrow(/description.*required|obrigatório/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });

  it("type em falta → lança erro de validação", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "Título válido",
        description: "Descrição válida",
        type: "" as never,
      }),
    ).rejects.toThrow(/type.*required|obrigatório/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });

  it("utilizador sem membership → rejeitar antes de criar", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "Título",
        description: "Descrição",
        type: "SCOPE",
      }),
    ).rejects.toThrow(/unauthorized|forbidden|403|sem permissão/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Change Comments — addChangeComment
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: addChangeComment — comments on change detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockChangeRecordFindUnique.mockResolvedValue(baseChange);
  });

  it("adiciona comentário com body válido", async () => {
    mockChangeCommentCreate.mockResolvedValue(baseComment);

    const result = await addChangeComment({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
      body: "Confirmar impacto financeiro com o gestor de custos.",
    });

    expect(result.body).toBe(
      "Confirmar impacto financeiro com o gestor de custos.",
    );
    expect(mockChangeCommentCreate).toHaveBeenCalledTimes(1);
  });

  it("body vazio → lança erro de validação", async () => {
    await expect(
      addChangeComment({
        orgId: ORG_ID,
        changeId: CHANGE_ID,
        body: "",
      }),
    ).rejects.toThrow(/required|body/i);

    expect(mockChangeCommentCreate).not.toHaveBeenCalled();
  });

  it("change não encontrado → lança erro", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(null);

    await expect(
      addChangeComment({
        orgId: ORG_ID,
        changeId: "nao-existe",
        body: "Comentário válido",
      }),
    ).rejects.toThrow(/not found|404/i);
  });
});
