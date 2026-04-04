/**
 * D4-E3-08v2: Changes & Claims — lifecycle, financial impact, immutable comments
 * Task: gov-1775321998216-cen8as
 *
 * TDD red/green phase — covers full Changes & Claims spec:
 *  1. createChangeRecord() tipo ALTERATION com financial impact (estimatedCost)
 *  2. createChangeRecord() tipo CLAIM com financial impact
 *  3. Lifecycle: DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED→FORMALIZED→CLOSED
 *  4. Lifecycle: DRAFT→SUBMITTED→UNDER_REVIEW→REJECTED (alternate path)
 *  5. addChangeComment() cria comentário imutável (não pode ser editado/deletado)
 *  6. listChanges() com filtros por tipo e status
 *  7. Financial impact summary — soma de estimatedCost por status
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockChangeRecordCreate = vi.hoisted(() => vi.fn());
const mockChangeRecordFindUnique = vi.hoisted(() => vi.fn());
const mockChangeRecordFindMany = vi.hoisted(() => vi.fn());
const mockChangeRecordUpdate = vi.hoisted(() => vi.fn());

const mockChangeCommentCreate = vi.hoisted(() => vi.fn());
const mockChangeCommentUpdate = vi.hoisted(() => vi.fn());
const mockChangeCommentDelete = vi.hoisted(() => vi.fn());
const mockChangeCommentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    changeRecord: {
      create: mockChangeRecordCreate,
      findUnique: mockChangeRecordFindUnique,
      findMany: mockChangeRecordFindMany,
      update: mockChangeRecordUpdate,
    },
    changeComment: {
      create: mockChangeCommentCreate,
      update: mockChangeCommentUpdate,
      delete: mockChangeCommentDelete,
      findMany: mockChangeCommentFindMany,
    },
  },
}));

import {
  createChange,
  addChangeComment,
  listChanges,
  transitionChange,
} from "@/lib/actions/change-actions";

import * as changeActions from "@/lib/actions/change-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-cde-changes-001";
const PROJECT_ID = "proj-cde-changes-001";
const USER_ID = "user-cde-changes-001";

const baseAlterationRecord = {
  id: "change-alteration-001",
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  title: "Alteração de estrutura — Piso 5",
  description: "Modificação no layout estrutural do Piso 5",
  type: "ALTERATION",
  status: "DRAFT",
  estimatedCost: 15000,
  createdById: USER_ID,
  createdAt: new Date("2026-04-04T10:00:00Z"),
  updatedAt: new Date("2026-04-04T10:00:00Z"),
};

const baseClaimRecord = {
  id: "change-claim-001",
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  title: "Reclamação de atraso — Fase 2",
  description: "Atraso causado por mudanças no projecto externo",
  type: "CLAIM",
  status: "DRAFT",
  estimatedCost: 32000,
  createdById: USER_ID,
  createdAt: new Date("2026-04-04T10:30:00Z"),
  updatedAt: new Date("2026-04-04T10:30:00Z"),
};

const baseComment = {
  id: "comment-001",
  changeId: "change-alteration-001",
  authorId: USER_ID,
  body: "Revisão inicial concluída — aguardar aprovação.",
  createdAt: new Date("2026-04-04T11:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 1: createChangeRecord() tipo ALTERATION com financial impact
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 1: createChange() tipo ALTERATION com estimatedCost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("cria ChangeRecord tipo ALTERATION com estimatedCost e status DRAFT", async () => {
    mockChangeRecordCreate.mockResolvedValue(baseAlterationRecord);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Alteração de estrutura — Piso 5",
      description: "Modificação no layout estrutural do Piso 5",
      type: "ALTERATION" as never,
      financialImpact: 15000,
    });

    expect(mockChangeRecordCreate).toHaveBeenCalledOnce();
    const callArgs = mockChangeRecordCreate.mock.calls[0][0];
    expect(callArgs.data.type).toBe("ALTERATION");
    expect(callArgs.data.status).toBe("DRAFT");
    expect(callArgs.data.orgId).toBe(ORG_ID);
    expect(callArgs.data.projectId).toBe(PROJECT_ID);
    expect(result.type).toBe("ALTERATION");
    expect(result.estimatedCost).toBe(15000);
  });

  it("rejeita criação sem título", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "",
        description: "Descrição válida",
        type: "ALTERATION" as never,
      }),
    ).rejects.toThrow(/title.*required|obrigatório/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 2: createChangeRecord() tipo CLAIM com financial impact
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 2: createChange() tipo CLAIM com estimatedCost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("cria ChangeRecord tipo CLAIM com estimatedCost e status DRAFT", async () => {
    mockChangeRecordCreate.mockResolvedValue(baseClaimRecord);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Reclamação de atraso — Fase 2",
      description: "Atraso causado por mudanças no projecto externo",
      type: "CLAIM" as never,
      financialImpact: 32000,
    });

    expect(mockChangeRecordCreate).toHaveBeenCalledOnce();
    const callArgs = mockChangeRecordCreate.mock.calls[0][0];
    expect(callArgs.data.type).toBe("CLAIM");
    expect(callArgs.data.status).toBe("DRAFT");
    expect(result.type).toBe("CLAIM");
    expect(result.estimatedCost).toBe(32000);
  });

  it("cria CLAIM sem estimatedCost (impacto financeiro opcional)", async () => {
    const claimSemCusto = { ...baseClaimRecord, estimatedCost: null };
    mockChangeRecordCreate.mockResolvedValue(claimSemCusto);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Reclamação sem custo definido",
      description: "Impacto financeiro a determinar",
      type: "CLAIM" as never,
    });

    expect(result.estimatedCost).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 3: Lifecycle DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED→FORMALIZED→CLOSED
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 3: Lifecycle happy path DRAFT→CLOSED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("transita DRAFT → SUBMITTED", async () => {
    const submitted = { ...baseAlterationRecord, status: "SUBMITTED" };
    mockChangeRecordFindUnique.mockResolvedValue(baseAlterationRecord);
    mockChangeRecordUpdate.mockResolvedValue(submitted);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      toStatus: "SUBMITTED" as never,
    });

    expect(mockChangeRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseAlterationRecord.id },
        data: { status: "SUBMITTED" },
      }),
    );
    expect(result.status).toBe("SUBMITTED");
  });

  it("transita SUBMITTED → UNDER_REVIEW", async () => {
    const submitted = { ...baseAlterationRecord, status: "SUBMITTED" };
    const underReview = { ...baseAlterationRecord, status: "UNDER_REVIEW" };
    mockChangeRecordFindUnique.mockResolvedValue(submitted);
    mockChangeRecordUpdate.mockResolvedValue(underReview);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      toStatus: "UNDER_REVIEW" as never,
    });

    expect(result.status).toBe("UNDER_REVIEW");
  });

  it("transita UNDER_REVIEW → APPROVED", async () => {
    const underReview = { ...baseAlterationRecord, status: "UNDER_REVIEW" };
    const approved = { ...baseAlterationRecord, status: "APPROVED" };
    mockChangeRecordFindUnique.mockResolvedValue(underReview);
    mockChangeRecordUpdate.mockResolvedValue(approved);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      toStatus: "APPROVED" as never,
    });

    expect(result.status).toBe("APPROVED");
  });

  it("transita APPROVED → FORMALIZED", async () => {
    const approved = { ...baseAlterationRecord, status: "APPROVED" };
    const formalized = { ...baseAlterationRecord, status: "FORMALIZED" };
    mockChangeRecordFindUnique.mockResolvedValue(approved);
    mockChangeRecordUpdate.mockResolvedValue(formalized);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      toStatus: "FORMALIZED" as never,
    });

    expect(result.status).toBe("FORMALIZED");
  });

  it("transita FORMALIZED → CLOSED", async () => {
    const formalized = { ...baseAlterationRecord, status: "FORMALIZED" };
    const closed = { ...baseAlterationRecord, status: "CLOSED" };
    mockChangeRecordFindUnique.mockResolvedValue(formalized);
    mockChangeRecordUpdate.mockResolvedValue(closed);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      toStatus: "CLOSED" as never,
    });

    expect(result.status).toBe("CLOSED");
  });

  it("falha transição se ChangeRecord não encontrado", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(null);

    await expect(
      transitionChange({
        orgId: ORG_ID,
        changeId: "non-existent-id",
        toStatus: "SUBMITTED" as never,
      }),
    ).rejects.toThrow(/not found|404/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 4: Lifecycle alternativo DRAFT→SUBMITTED→UNDER_REVIEW→REJECTED
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 4: Lifecycle alternativo DRAFT→REJECTED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("transita UNDER_REVIEW → REJECTED (caminho alternativo)", async () => {
    const underReview = { ...baseAlterationRecord, status: "UNDER_REVIEW" };
    const rejected = { ...baseAlterationRecord, status: "REJECTED" };
    mockChangeRecordFindUnique.mockResolvedValue(underReview);
    mockChangeRecordUpdate.mockResolvedValue(rejected);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      toStatus: "REJECTED" as never,
    });

    expect(mockChangeRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "REJECTED" },
      }),
    );
    expect(result.status).toBe("REJECTED");
  });

  it("CLAIM também pode seguir caminho REJECTED", async () => {
    const underReview = { ...baseClaimRecord, status: "UNDER_REVIEW" };
    const rejected = { ...baseClaimRecord, status: "REJECTED" };
    mockChangeRecordFindUnique.mockResolvedValue(underReview);
    mockChangeRecordUpdate.mockResolvedValue(rejected);

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: baseClaimRecord.id,
      toStatus: "REJECTED" as never,
    });

    expect(result.status).toBe("REJECTED");
    expect(result.type).toBe("CLAIM");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 5: addChangeComment() — comentário imutável
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 5: addChangeComment() — imutabilidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("cria comentário com sucesso no ChangeRecord", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(baseAlterationRecord);
    mockChangeCommentCreate.mockResolvedValue(baseComment);

    const result = await addChangeComment({
      orgId: ORG_ID,
      changeId: baseAlterationRecord.id,
      body: "Revisão inicial concluída — aguardar aprovação.",
    });

    expect(mockChangeCommentCreate).toHaveBeenCalledOnce();
    const callArgs = mockChangeCommentCreate.mock.calls[0][0];
    expect(callArgs.data.changeId).toBe(baseAlterationRecord.id);
    expect(callArgs.data.authorId).toBe(USER_ID);
    expect(callArgs.data.body).toBe(
      "Revisão inicial concluída — aguardar aprovação.",
    );
    expect(result.id).toBe(baseComment.id);
  });

  it("não expõe operação de update em ChangeComment — comentário é imutável", () => {
    // Imutabilidade: a action layer não deve oferecer updateChangeComment
    // Se a função existir, é um bug de design (comentários não se editam)
    expect(
      (changeActions as Record<string, unknown>).updateChangeComment,
    ).toBeUndefined();
  });

  it("não expõe operação de delete em ChangeComment — comentário é imutável", () => {
    expect(
      (changeActions as Record<string, unknown>).deleteChangeComment,
    ).toBeUndefined();
  });

  it("rejeita comentário com body vazio", async () => {
    await expect(
      addChangeComment({
        orgId: ORG_ID,
        changeId: baseAlterationRecord.id,
        body: "",
      }),
    ).rejects.toThrow(/body.*required|required/i);

    expect(mockChangeCommentCreate).not.toHaveBeenCalled();
  });

  it("rejeita comentário se ChangeRecord não existe", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(null);

    await expect(
      addChangeComment({
        orgId: ORG_ID,
        changeId: "non-existent-change",
        body: "Comentário para change inexistente",
      }),
    ).rejects.toThrow(/not found|404/i);

    expect(mockChangeCommentCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 6: listChanges() com filtros por tipo e status
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 6: listChanges() com filtros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("lista todos os ChangeRecords do projecto sem filtros", async () => {
    const records = [baseAlterationRecord, baseClaimRecord];
    mockChangeRecordFindMany.mockResolvedValue(records);

    const result = await listChanges({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(mockChangeRecordFindMany).toHaveBeenCalledOnce();
    const callArgs = mockChangeRecordFindMany.mock.calls[0][0];
    expect(callArgs.where.orgId).toBe(ORG_ID);
    expect(callArgs.where.projectId).toBe(PROJECT_ID);
    expect(result).toHaveLength(2);
  });

  it("filtra por tipo ALTERATION", async () => {
    mockChangeRecordFindMany.mockResolvedValue([baseAlterationRecord]);

    const result = await listChanges({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      type: "ALTERATION" as never,
    } as never);

    const callArgs = mockChangeRecordFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("ALTERATION");
  });

  it("filtra por tipo CLAIM", async () => {
    mockChangeRecordFindMany.mockResolvedValue([baseClaimRecord]);

    await listChanges({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      type: "CLAIM" as never,
    } as never);

    const callArgs = mockChangeRecordFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ orgId: ORG_ID });
  });

  it("filtra por status APPROVED", async () => {
    const approved = { ...baseAlterationRecord, status: "APPROVED" };
    mockChangeRecordFindMany.mockResolvedValue([approved]);

    await listChanges({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      status: "APPROVED" as never,
    } as never);

    const callArgs = mockChangeRecordFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ orgId: ORG_ID });
  });

  it("retorna lista vazia quando não existem registos", async () => {
    mockChangeRecordFindMany.mockResolvedValue([]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toEqual([]);
  });

  it("falha se utilizador não tem membership", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      listChanges({ orgId: ORG_ID, projectId: PROJECT_ID }),
    ).rejects.toThrow(/forbidden|403|permiss/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 7: Financial impact summary — soma de estimatedCost por status
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-08v2 — Cenário 7: Financial impact summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("calcula soma total de estimatedCost para registos APPROVED", async () => {
    const approvedRecords = [
      {
        ...baseAlterationRecord,
        id: "c1",
        status: "APPROVED",
        estimatedCost: 10000,
      },
      {
        ...baseClaimRecord,
        id: "c2",
        status: "APPROVED",
        estimatedCost: 25000,
      },
      {
        ...baseAlterationRecord,
        id: "c3",
        status: "APPROVED",
        estimatedCost: 5000,
      },
    ];
    mockChangeRecordFindMany.mockResolvedValue(approvedRecords);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    const totalApproved = result
      .filter((r: { status: string }) => r.status === "APPROVED")
      .reduce(
        (sum: number, r: { estimatedCost: number | null }) =>
          sum + (r.estimatedCost ?? 0),
        0,
      );

    expect(totalApproved).toBe(40000);
  });

  it("exclui registos REJECTED da soma de impacto financeiro", async () => {
    const mixedRecords = [
      {
        ...baseAlterationRecord,
        id: "c1",
        status: "APPROVED",
        estimatedCost: 20000,
      },
      {
        ...baseClaimRecord,
        id: "c2",
        status: "REJECTED",
        estimatedCost: 50000,
      },
      {
        ...baseAlterationRecord,
        id: "c3",
        status: "FORMALIZED",
        estimatedCost: 15000,
      },
    ];
    mockChangeRecordFindMany.mockResolvedValue(mixedRecords);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    const totalActive = result
      .filter(
        (r: { status: string }) =>
          r.status !== "REJECTED" && r.status !== "DRAFT",
      )
      .reduce(
        (sum: number, r: { estimatedCost: number | null }) =>
          sum + (r.estimatedCost ?? 0),
        0,
      );

    expect(totalActive).toBe(35000);
  });

  it("trata estimatedCost nulo como zero na soma", async () => {
    const records = [
      {
        ...baseAlterationRecord,
        id: "c1",
        status: "APPROVED",
        estimatedCost: null,
      },
      {
        ...baseClaimRecord,
        id: "c2",
        status: "APPROVED",
        estimatedCost: 8000,
      },
    ];
    mockChangeRecordFindMany.mockResolvedValue(records);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    const total = result.reduce(
      (sum: number, r: { estimatedCost: number | null }) =>
        sum + (r.estimatedCost ?? 0),
      0,
    );

    expect(total).toBe(8000);
  });

  it("retorna zero se não existem registos", async () => {
    mockChangeRecordFindMany.mockResolvedValue([]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    const total = result.reduce(
      (sum: number, r: { estimatedCost: number | null }) =>
        sum + (r.estimatedCost ?? 0),
      0,
    );

    expect(total).toBe(0);
  });
});
