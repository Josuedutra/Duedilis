/**
 * Changes & Transmittals Frontend Tests — Sprint D4, Task D4-E3-12v2
 * gov-1775322033502-xs7sjb
 *
 * Tests for /changes and /transmittals frontend pages:
 *
 * Changes:
 *  1. Lista renderiza ChangeRecords com tipo e status badge
 *  2. Formulário de criação: tipo, título, descrição, financialImpact
 *  3. Detalhe mostra timeline de comentários imutáveis
 *  4. Botão de transição de status visível conforme lifecycle
 *
 * Transmittals:
 *  5. Lista renderiza Transmittals com status (DRAFT/SENT/RECEIVED)
 *  6. Formulário de criação: subject, notes, selecção de documentos
 *  7. Botão "Send" só visível para DRAFT com ≥1 documento
 *  8. Detalhe mostra recipients + receipt status
 *
 * Note: vitest environment is "node" — tests exercise server actions and
 * pure UI helper utilities that power the React components (TDD pattern).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks — Changes ────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockChangeRecordFindMany = vi.hoisted(() => vi.fn());
const mockChangeRecordFindUnique = vi.hoisted(() => vi.fn());
const mockChangeRecordCreate = vi.hoisted(() => vi.fn());
const mockChangeRecordUpdate = vi.hoisted(() => vi.fn());
const mockChangeCommentCreate = vi.hoisted(() => vi.fn());

// ─── Hoist mocks — Transmittals ───────────────────────────────────────────────
const mockTransmittalFindMany = vi.hoisted(() => vi.fn());
const mockTransmittalFindUnique = vi.hoisted(() => vi.fn());
const mockTransmittalCreate = vi.hoisted(() => vi.fn());
const mockTransmittalUpdate = vi.hoisted(() => vi.fn());
const mockTransmittalDocumentCreate = vi.hoisted(() => vi.fn());
const mockTransmittalDocumentFindFirst = vi.hoisted(() => vi.fn());
const mockTransmittalRecipientCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: { findUnique: mockOrgMembershipFindUnique },
    changeRecord: {
      findMany: mockChangeRecordFindMany,
      findUnique: mockChangeRecordFindUnique,
      create: mockChangeRecordCreate,
      update: mockChangeRecordUpdate,
    },
    changeComment: { create: mockChangeCommentCreate },
    transmittal: {
      findMany: mockTransmittalFindMany,
      findUnique: mockTransmittalFindUnique,
      create: mockTransmittalCreate,
      update: mockTransmittalUpdate,
    },
    transmittalDocument: {
      create: mockTransmittalDocumentCreate,
      findFirst: mockTransmittalDocumentFindFirst,
    },
    transmittalRecipient: { create: mockTransmittalRecipientCreate },
  },
}));

import {
  listChanges,
  getChangeDetail,
  createChange,
  addChangeComment,
  transitionChange,
  canTransitionChange,
  hasImmutableComments,
} from "@/lib/actions/change-actions";

import {
  listTransmittals,
  getTransmittalDetail,
  createTransmittal,
  addDocumentsToTransmittal,
  addRecipientsToTransmittal,
  sendTransmittal,
  canSendTransmittal,
} from "@/lib/actions/transmittal-actions";

import {
  getChangeStatusBadgeConfig,
  getTransmittalStatusBadgeConfig,
} from "@/lib/status-badges";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ORG_ID = "org-fe-001";
const PROJECT_ID = "proj-fe-001";
const CHANGE_ID = "change-fe-001";
const TRANSMITTAL_ID = "transmittal-fe-001";

const baseChange = {
  id: CHANGE_ID,
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  title: "Alteração fachada norte",
  description: "Substituição de revestimento cerâmico por ACM.",
  type: "SCOPE",
  status: "DRAFT",
  financialImpact: 32000,
  createdAt: new Date("2026-04-04T08:00:00Z"),
  updatedAt: new Date("2026-04-04T08:00:00Z"),
  author: { id: "user-1", name: "Marta Silva", email: "marta@test.com" },
};

const baseComment = {
  id: "comment-fe-001",
  changeId: CHANGE_ID,
  authorId: "user-1",
  body: "Verificar compatibilidade com estrutura existente.",
  createdAt: new Date("2026-04-04T09:00:00Z"),
  author: { id: "user-1", name: "Marta Silva" },
};

const baseChangeWithRelations = {
  ...baseChange,
  comments: [baseComment],
  linkedDocuments: [],
};

const baseTransmittal = {
  id: TRANSMITTAL_ID,
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  subject: "Transmittal ARQ-REV-001",
  notes: "Para aprovação do cliente.",
  status: "DRAFT",
  sentAt: null,
  createdAt: new Date("2026-04-04T10:00:00Z"),
  _count: { documents: 2, recipients: 1 },
};

const baseTransmittalDetail = {
  ...baseTransmittal,
  documents: [
    {
      id: "td-001",
      transmittalId: TRANSMITTAL_ID,
      documentId: "doc-001",
      document: {
        id: "doc-001",
        originalName: "ARQ-PLT-001-R0.pdf",
        status: "CONFIRMED",
      },
    },
  ],
  recipients: [
    {
      id: "rec-001",
      transmittalId: TRANSMITTAL_ID,
      email: "cliente@construtora.pt",
      name: "Carlos Ferreira",
      receivedAt: null,
    },
  ],
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function setupAuth() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockOrgMembershipFindUnique.mockResolvedValue({
    id: "mem-1",
    role: "GESTOR_PROJETO",
  });
}

// =============================================================================
// 1. Changes — Lista renderiza ChangeRecords com tipo e status badge
// =============================================================================

describe("getChangeStatusBadgeConfig — status badge para todos os estados", () => {
  it("DRAFT → variant default", () => {
    const cfg = getChangeStatusBadgeConfig("DRAFT");
    expect(cfg.variant).toBe("default");
    expect(cfg.label).toBeTruthy();
  });

  it("OPEN → variant warning", () => {
    const cfg = getChangeStatusBadgeConfig("OPEN");
    expect(cfg.variant).toBe("warning");
    expect(cfg.label).toBeTruthy();
  });

  it("UNDER_REVIEW → variant warning", () => {
    const cfg = getChangeStatusBadgeConfig("UNDER_REVIEW");
    expect(cfg.variant).toBe("warning");
    expect(cfg.label).toBeTruthy();
  });

  it("APPROVED → variant success", () => {
    const cfg = getChangeStatusBadgeConfig("APPROVED");
    expect(cfg.variant).toBe("success");
    expect(cfg.label).toBeTruthy();
  });

  it("REJECTED → variant error", () => {
    const cfg = getChangeStatusBadgeConfig("REJECTED");
    expect(cfg.variant).toBe("error");
    expect(cfg.label).toBeTruthy();
  });

  it("CLOSED → variant default", () => {
    const cfg = getChangeStatusBadgeConfig("CLOSED");
    expect(cfg.variant).toBe("default");
    expect(cfg.label).toBeTruthy();
  });

  it("status desconhecido → fallback sem crash", () => {
    const cfg = getChangeStatusBadgeConfig("UNKNOWN_STATUS");
    expect(cfg).toBeDefined();
    expect(cfg.variant).toBeTruthy();
    expect(cfg.label).toBeTruthy();
  });
});

describe("listChanges — lista de Changes com tipo e status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("retorna ChangeRecords com tipo e status", async () => {
    const changes = [
      baseChange,
      {
        ...baseChange,
        id: "change-fe-002",
        type: "COST",
        status: "OPEN",
        financialImpact: 8000,
      },
    ];
    mockChangeRecordFindMany.mockResolvedValue(changes);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("SCOPE");
    expect(result[0].status).toBe("DRAFT");
    expect(result[1].type).toBe("COST");
    expect(result[1].status).toBe("OPEN");
  });

  it("lista vazia quando não há changes", async () => {
    mockChangeRecordFindMany.mockResolvedValue([]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toEqual([]);
  });

  it("sem membership → rejeita com erro de permissão", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      listChanges({ orgId: ORG_ID, projectId: PROJECT_ID }),
    ).rejects.toThrow(/unauthorized|forbidden|403|sem permissão/i);

    expect(mockChangeRecordFindMany).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 2. Changes — Formulário de criação: tipo, título, descrição, financialImpact
// =============================================================================

describe("createChange — formulário de criação de change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("cria change com tipo, título, descrição e financialImpact", async () => {
    const created = { ...baseChange, id: "change-new-001" };
    mockChangeRecordCreate.mockResolvedValue(created);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Alteração fachada norte",
      description: "Substituição de revestimento cerâmico por ACM.",
      type: "SCOPE",
      financialImpact: 32000,
    });

    expect(result.id).toBe("change-new-001");
    expect(mockChangeRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Alteração fachada norte",
          description: "Substituição de revestimento cerâmico por ACM.",
          type: "SCOPE",
          status: "DRAFT",
          financialImpact: 32000,
        }),
      }),
    );
  });

  it("cria change sem financialImpact (campo opcional)", async () => {
    mockChangeRecordCreate.mockResolvedValue({
      ...baseChange,
      financialImpact: null,
    });

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Alteração de planta",
      description: "Redesenho do piso 2.",
      type: "DESIGN",
    });

    expect(result.financialImpact).toBeNull();
  });

  it("título vazio → lança erro de validação", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "",
        description: "Desc válida.",
        type: "SCOPE",
      }),
    ).rejects.toThrow(/title.*required|obrigatório/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });

  it("descrição vazia → lança erro de validação", async () => {
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

  it("tipo ausente → lança erro de validação", async () => {
    await expect(
      createChange({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        title: "Título válido",
        description: "Descrição válida.",
        type: "" as never,
      }),
    ).rejects.toThrow(/type.*required|obrigatório/i);

    expect(mockChangeRecordCreate).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 3. Changes — Detalhe mostra timeline de comentários imutáveis
// =============================================================================

describe("hasImmutableComments — timeline de comentários imutáveis", () => {
  it("APPROVED → comentários imutáveis", () => {
    expect(hasImmutableComments("APPROVED")).toBe(true);
  });

  it("REJECTED → comentários imutáveis", () => {
    expect(hasImmutableComments("REJECTED")).toBe(true);
  });

  it("CLOSED → comentários imutáveis", () => {
    expect(hasImmutableComments("CLOSED")).toBe(true);
  });

  it("DRAFT → comentários editáveis", () => {
    expect(hasImmutableComments("DRAFT")).toBe(false);
  });

  it("OPEN → comentários editáveis", () => {
    expect(hasImmutableComments("OPEN")).toBe(false);
  });

  it("UNDER_REVIEW → comentários editáveis", () => {
    expect(hasImmutableComments("UNDER_REVIEW")).toBe(false);
  });
});

describe("getChangeDetail — detalhe com timeline de comentários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("retorna change com comments ordenados por data", async () => {
    const withMultipleComments = {
      ...baseChangeWithRelations,
      comments: [
        baseComment,
        {
          id: "comment-fe-002",
          changeId: CHANGE_ID,
          authorId: "user-2",
          body: "Aprovado pelo gestor de custos.",
          createdAt: new Date("2026-04-04T11:00:00Z"),
          author: { id: "user-2", name: "João Pereira" },
        },
      ],
    };
    mockChangeRecordFindUnique.mockResolvedValue(withMultipleComments);

    const result = await getChangeDetail({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
    });

    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].body).toBe(
      "Verificar compatibilidade com estrutura existente.",
    );
    expect(result.comments[1].body).toBe("Aprovado pelo gestor de custos.");
  });

  it("change não encontrado → lança 404", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(null);

    await expect(
      getChangeDetail({ orgId: ORG_ID, changeId: "nonexistent" }),
    ).rejects.toThrow(/not found|404/i);
  });
});

describe("addChangeComment — adicionar comentário à timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("adiciona comentário válido", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(baseChange);
    mockChangeCommentCreate.mockResolvedValue(baseComment);

    const result = await addChangeComment({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
      body: "Verificar compatibilidade com estrutura existente.",
    });

    expect(result.id).toBe("comment-fe-001");
    expect(mockChangeCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeId: CHANGE_ID,
          body: "Verificar compatibilidade com estrutura existente.",
        }),
      }),
    );
  });

  it("body vazio → lança erro de validação", async () => {
    await expect(
      addChangeComment({ orgId: ORG_ID, changeId: CHANGE_ID, body: "" }),
    ).rejects.toThrow(/body.*required|obrigatório/i);

    expect(mockChangeCommentCreate).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 4. Changes — Botão de transição de status visível conforme lifecycle
// =============================================================================

describe("canTransitionChange — botão de transição visível conforme lifecycle", () => {
  it("DRAFT → pode transitar", () => {
    expect(canTransitionChange("DRAFT")).toBe(true);
  });

  it("OPEN → pode transitar", () => {
    expect(canTransitionChange("OPEN")).toBe(true);
  });

  it("UNDER_REVIEW → pode transitar", () => {
    expect(canTransitionChange("UNDER_REVIEW")).toBe(true);
  });

  it("APPROVED → não pode transitar (estado terminal)", () => {
    expect(canTransitionChange("APPROVED")).toBe(false);
  });

  it("REJECTED → não pode transitar (estado terminal)", () => {
    expect(canTransitionChange("REJECTED")).toBe(false);
  });

  it("CLOSED → não pode transitar (estado terminal)", () => {
    expect(canTransitionChange("CLOSED")).toBe(false);
  });
});

describe("transitionChange — server action de transição de status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("DRAFT → OPEN com sucesso", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(baseChange);
    mockChangeRecordUpdate.mockResolvedValue({ ...baseChange, status: "OPEN" });

    const result = await transitionChange({
      orgId: ORG_ID,
      changeId: CHANGE_ID,
      toStatus: "OPEN",
    });

    expect(result.status).toBe("OPEN");
    expect(mockChangeRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OPEN" }),
      }),
    );
  });

  it("OPEN → UNDER_REVIEW com sucesso", async () => {
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

  it("change não encontrado → lança 404", async () => {
    mockChangeRecordFindUnique.mockResolvedValue(null);

    await expect(
      transitionChange({
        orgId: ORG_ID,
        changeId: "nonexistent",
        toStatus: "OPEN",
      }),
    ).rejects.toThrow(/not found|404/i);
  });
});

// =============================================================================
// 5. Transmittals — Lista renderiza Transmittals com status (DRAFT/SENT/RECEIVED)
// =============================================================================

describe("getTransmittalStatusBadgeConfig — badge para todos os estados", () => {
  it("DRAFT → variant default", () => {
    const cfg = getTransmittalStatusBadgeConfig("DRAFT");
    expect(cfg.variant).toBe("default");
    expect(cfg.label).toBeTruthy();
  });

  it("SENT → variant warning", () => {
    const cfg = getTransmittalStatusBadgeConfig("SENT");
    expect(cfg.variant).toBe("warning");
    expect(cfg.label).toBeTruthy();
  });

  it("RECEIVED → variant success", () => {
    const cfg = getTransmittalStatusBadgeConfig("RECEIVED");
    expect(cfg.variant).toBe("success");
    expect(cfg.label).toBeTruthy();
  });

  it("status desconhecido → fallback sem crash", () => {
    const cfg = getTransmittalStatusBadgeConfig("PENDING");
    expect(cfg).toBeDefined();
    expect(cfg.label).toBeTruthy();
  });
});

describe("listTransmittals — lista de Transmittals com status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("retorna Transmittals com status DRAFT/SENT", async () => {
    const transmittals = [
      baseTransmittal,
      {
        ...baseTransmittal,
        id: "transmittal-fe-002",
        subject: "Transmittal EST-REV-001",
        status: "SENT",
        sentAt: new Date("2026-04-04T12:00:00Z"),
        _count: { documents: 3, recipients: 2 },
      },
    ];
    mockTransmittalFindMany.mockResolvedValue(transmittals);

    const result = await listTransmittals({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("DRAFT");
    expect(result[1].status).toBe("SENT");
  });

  it("lista vazia quando não há transmittals", async () => {
    mockTransmittalFindMany.mockResolvedValue([]);

    const result = await listTransmittals({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(result).toEqual([]);
  });

  it("sem membership → rejeita com erro de permissão", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      listTransmittals({ orgId: ORG_ID, projectId: PROJECT_ID }),
    ).rejects.toThrow(/unauthorized|forbidden|403|sem permissão/i);

    expect(mockTransmittalFindMany).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 6. Transmittals — Formulário de criação: subject, notes, selecção de docs
// =============================================================================

describe("createTransmittal — formulário de criação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("cria transmittal com subject e notes", async () => {
    mockTransmittalCreate.mockResolvedValue(baseTransmittal);

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Transmittal ARQ-REV-001",
      notes: "Para aprovação do cliente.",
    });

    expect(result.subject).toBe("Transmittal ARQ-REV-001");
    expect(result.status).toBe("DRAFT");
    expect(mockTransmittalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: "Transmittal ARQ-REV-001",
          notes: "Para aprovação do cliente.",
          status: "DRAFT",
        }),
      }),
    );
  });

  it("cria transmittal sem notes (campo opcional)", async () => {
    mockTransmittalCreate.mockResolvedValue({
      ...baseTransmittal,
      notes: null,
    });

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Transmittal sem notas",
    });

    expect(result.notes).toBeNull();
  });
});

describe("addDocumentsToTransmittal — selecção de documentos no formulário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("adiciona documentos ao transmittal", async () => {
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalDocumentFindFirst.mockResolvedValue(null);
    mockTransmittalDocumentCreate
      .mockResolvedValueOnce({
        id: "td-001",
        transmittalId: TRANSMITTAL_ID,
        documentId: "doc-001",
      })
      .mockResolvedValueOnce({
        id: "td-002",
        transmittalId: TRANSMITTAL_ID,
        documentId: "doc-002",
      });

    const result = await addDocumentsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      documentIds: ["doc-001", "doc-002"],
    });

    expect(result).toHaveLength(2);
    expect(mockTransmittalDocumentCreate).toHaveBeenCalledTimes(2);
  });

  it("documento duplicado → rejeita com 409", async () => {
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalDocumentFindFirst.mockResolvedValue({
      id: "td-existing",
      transmittalId: TRANSMITTAL_ID,
      documentId: "doc-001",
    });

    await expect(
      addDocumentsToTransmittal({
        orgId: ORG_ID,
        transmittalId: TRANSMITTAL_ID,
        documentIds: ["doc-001"],
      }),
    ).rejects.toThrow(/duplicate|já existe|409/i);
  });
});

// =============================================================================
// 7. Transmittals — Botão "Send" só visível para DRAFT com ≥1 documento
// =============================================================================

describe("canSendTransmittal — botão Send visível só para DRAFT com docs", () => {
  it("DRAFT + 1 documento → pode enviar", () => {
    expect(canSendTransmittal("DRAFT", 1)).toBe(true);
  });

  it("DRAFT + 3 documentos → pode enviar", () => {
    expect(canSendTransmittal("DRAFT", 3)).toBe(true);
  });

  it("DRAFT + 0 documentos → não pode enviar", () => {
    expect(canSendTransmittal("DRAFT", 0)).toBe(false);
  });

  it("SENT + 2 documentos → não pode enviar (já enviado)", () => {
    expect(canSendTransmittal("SENT", 2)).toBe(false);
  });

  it("RECEIVED + 2 documentos → não pode enviar", () => {
    expect(canSendTransmittal("RECEIVED", 2)).toBe(false);
  });
});

describe("sendTransmittal — server action de envio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("DRAFT → SENT com sucesso", async () => {
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalUpdate.mockResolvedValue({
      ...baseTransmittal,
      status: "SENT",
      sentAt: new Date(),
    });

    const result = await sendTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result.status).toBe("SENT");
    expect(result.sentAt).toBeDefined();
    expect(mockTransmittalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });

  it("SENT → rejeita com 409 (já enviado)", async () => {
    mockTransmittalFindUnique.mockResolvedValue({
      ...baseTransmittal,
      status: "SENT",
    });

    await expect(
      sendTransmittal({ orgId: ORG_ID, transmittalId: TRANSMITTAL_ID }),
    ).rejects.toThrow(/já enviado|already sent|409/i);

    expect(mockTransmittalUpdate).not.toHaveBeenCalled();
  });

  it("transmittal não encontrado → lança 404", async () => {
    mockTransmittalFindUnique.mockResolvedValue(null);

    await expect(
      sendTransmittal({ orgId: ORG_ID, transmittalId: "nonexistent" }),
    ).rejects.toThrow(/not found|404/i);
  });
});

// =============================================================================
// 8. Transmittals — Detalhe mostra recipients + receipt status
// =============================================================================

describe("getTransmittalDetail — detalhe com recipients e receipt status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("retorna transmittal com recipients e documentos", async () => {
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittalDetail);

    const result = await getTransmittalDetail({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].email).toBe("cliente@construtora.pt");
    expect(result.recipients[0].receivedAt).toBeNull();
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].document.originalName).toBe(
      "ARQ-PLT-001-R0.pdf",
    );
  });

  it("recipient com receivedAt preenchido → receipt confirmado", async () => {
    const receivedAt = new Date("2026-04-04T15:00:00Z");
    const withReceipt = {
      ...baseTransmittalDetail,
      recipients: [
        {
          ...baseTransmittalDetail.recipients[0],
          receivedAt,
        },
      ],
    };
    mockTransmittalFindUnique.mockResolvedValue(withReceipt);

    const result = await getTransmittalDetail({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result.recipients[0].receivedAt).toEqual(receivedAt);
  });

  it("transmittal não encontrado → lança 404", async () => {
    mockTransmittalFindUnique.mockResolvedValue(null);

    await expect(
      getTransmittalDetail({ orgId: ORG_ID, transmittalId: "nonexistent" }),
    ).rejects.toThrow(/not found|404/i);
  });
});

describe("addRecipientsToTransmittal — adicionar recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it("adiciona recipients ao transmittal", async () => {
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalRecipientCreate.mockResolvedValue({
      id: "rec-001",
      transmittalId: TRANSMITTAL_ID,
      email: "cliente@construtora.pt",
      name: "Carlos Ferreira",
      receivedAt: null,
    });

    const result = await addRecipientsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      recipients: [
        { email: "cliente@construtora.pt", name: "Carlos Ferreira" },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("cliente@construtora.pt");
    expect(result[0].receivedAt).toBeNull();
  });
});
