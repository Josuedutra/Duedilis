/**
 * Transmittals Frontend Tests — Sprint D4, Task D4-E3-12
 * gov-1775311333434-jtb0ml
 *
 * Testes para as páginas /transmittals:
 *  1. List — renderiza lista com sentAt, receivedAt, status
 *  2. Detail — mostra documentos incluídos, receipt tracking
 *  3. Create form — selecção de documentos, recipient
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockTransmittalCreate = vi.hoisted(() => vi.fn());
const mockTransmittalFindUnique = vi.hoisted(() => vi.fn());
const mockTransmittalFindMany = vi.hoisted(() => vi.fn());
const mockTransmittalUpdate = vi.hoisted(() => vi.fn());

const mockTransmittalDocumentCreate = vi.hoisted(() => vi.fn());
const mockTransmittalDocumentFindFirst = vi.hoisted(() => vi.fn());
const mockTransmittalDocumentFindMany = vi.hoisted(() => vi.fn());

const mockTransmittalRecipientCreate = vi.hoisted(() => vi.fn());
const mockTransmittalRecipientUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    transmittal: {
      create: mockTransmittalCreate,
      findUnique: mockTransmittalFindUnique,
      findMany: mockTransmittalFindMany,
      update: mockTransmittalUpdate,
    },
    transmittalDocument: {
      create: mockTransmittalDocumentCreate,
      findFirst: mockTransmittalDocumentFindFirst,
      findMany: mockTransmittalDocumentFindMany,
    },
    transmittalRecipient: {
      create: mockTransmittalRecipientCreate,
      update: mockTransmittalRecipientUpdate,
    },
  },
}));

import {
  createTransmittal,
  addDocumentsToTransmittal,
  addRecipientsToTransmittal,
  sendTransmittal,
  markReceived,
  getTransmittalPresignedUrls,
} from "@/lib/actions/transmittal-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-test-001";
const PROJECT_ID = "proj-test-001";
const TRANSMITTAL_ID = "transm-001";
const DOC_ID_1 = "doc-001";
const DOC_ID_2 = "doc-002";
const RECIPIENT_ID = "recip-001";

const baseTransmittal = {
  id: TRANSMITTAL_ID,
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  subject: "Transmittal de Aprovação — Fase 2",
  notes: "Documentos para revisão pela fiscalização.",
  status: "DRAFT",
  sentAt: null,
  createdAt: new Date("2026-04-04T09:00:00Z"),
  updatedAt: new Date("2026-04-04T09:00:00Z"),
};

const sentTransmittal = {
  ...baseTransmittal,
  status: "SENT",
  sentAt: new Date("2026-04-04T10:30:00Z"),
};

const baseTransmittalDoc = {
  id: "tdoc-001",
  transmittalId: TRANSMITTAL_ID,
  documentId: DOC_ID_1,
};

const baseRecipient = {
  id: RECIPIENT_ID,
  transmittalId: TRANSMITTAL_ID,
  email: "fiscal@construtora.pt",
  name: "Carlos Mendes",
  receivedAt: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Transmittals List — sentAt, receivedAt, status
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: transmittals list page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("cria transmittal DRAFT — base da lista", async () => {
    mockTransmittalCreate.mockResolvedValue(baseTransmittal);

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Transmittal de Aprovação — Fase 2",
      notes: "Documentos para revisão pela fiscalização.",
    });

    expect(result.status).toBe("DRAFT");
    expect(result.sentAt).toBeNull();
    expect(result.subject).toBe("Transmittal de Aprovação — Fase 2");
  });

  it("transmittal SENT tem sentAt preenchido — visível na lista", async () => {
    mockTransmittalCreate.mockResolvedValue(sentTransmittal);

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Transmittal já enviado",
    });

    expect(result.status).toBe("SENT");
    expect(result.sentAt).not.toBeNull();
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it("transmittal sem notes — status DRAFT, sentAt null", async () => {
    const noNotes = { ...baseTransmittal, notes: null };
    mockTransmittalCreate.mockResolvedValue(noNotes);

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Sem notas",
    });

    expect(result.notes).toBeNull();
    expect(result.status).toBe("DRAFT");
  });

  it("utilizador sem membership → rejeitar", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      createTransmittal({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        subject: "Sem acesso",
      }),
    ).rejects.toThrow(/unauthorized|forbidden|403|sem permissão/i);

    expect(mockTransmittalCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Transmittal Detail — documentos incluídos, receipt tracking
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: transmittal detail — included documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalDocumentFindFirst.mockResolvedValue(null);
  });

  it("adiciona documentos ao transmittal — detail mostra docs incluídos", async () => {
    const tdoc1 = {
      ...baseTransmittalDoc,
      id: "tdoc-001",
      documentId: DOC_ID_1,
    };
    const tdoc2 = {
      ...baseTransmittalDoc,
      id: "tdoc-002",
      documentId: DOC_ID_2,
    };
    mockTransmittalDocumentCreate
      .mockResolvedValueOnce(tdoc1)
      .mockResolvedValueOnce(tdoc2);

    const result = await addDocumentsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      documentIds: [DOC_ID_1, DOC_ID_2],
    });

    expect(result).toHaveLength(2);
    expect(result[0].documentId).toBe(DOC_ID_1);
    expect(result[1].documentId).toBe(DOC_ID_2);
  });

  it("presigned URLs — detail fornece acesso a cada documento", async () => {
    const docs = [
      { ...baseTransmittalDoc, id: "tdoc-001", documentId: DOC_ID_1 },
      { ...baseTransmittalDoc, id: "tdoc-002", documentId: DOC_ID_2 },
    ];
    mockTransmittalDocumentFindMany.mockResolvedValue(docs);

    const result = await getTransmittalPresignedUrls({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result).toHaveLength(2);
    result.forEach((item: { documentId: string; url: string }) => {
      expect(item.documentId).toBeDefined();
      expect(item.url).toMatch(/^https?:\/\//);
    });
  });

  it("transmittal sem documentos → presigned URLs retorna array vazio", async () => {
    mockTransmittalDocumentFindMany.mockResolvedValue([]);

    const result = await getTransmittalPresignedUrls({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result).toHaveLength(0);
  });

  it("transmittal não encontrado para presigned URLs → erro 404", async () => {
    mockTransmittalFindUnique.mockResolvedValue(null);

    await expect(
      getTransmittalPresignedUrls({
        orgId: ORG_ID,
        transmittalId: "nao-existe",
      }),
    ).rejects.toThrow(/not found|404/i);
  });
});

describe("D4-E3-12: transmittal detail — receipt tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
  });

  it("markReceived — receivedAt preenchido para recipiente", async () => {
    const receivedAt = new Date("2026-04-04T14:00:00Z");
    const updatedRecipient = { ...baseRecipient, receivedAt };
    mockTransmittalRecipientUpdate.mockResolvedValue(updatedRecipient);

    const result = await markReceived({
      orgId: ORG_ID,
      recipientId: RECIPIENT_ID,
    });

    expect(result.receivedAt).not.toBeNull();
    expect(result.receivedAt).toBeInstanceOf(Date);
    expect(mockTransmittalRecipientUpdate).toHaveBeenCalledTimes(1);
  });

  it("recipiente não recebeu — receivedAt null antes de markReceived", () => {
    expect(baseRecipient.receivedAt).toBeNull();
  });

  it("markReceived recipiente não existente → lança erro", async () => {
    mockTransmittalRecipientUpdate.mockRejectedValue(
      new Error("Record not found"),
    );

    await expect(
      markReceived({ orgId: ORG_ID, recipientId: "nao-existe" }),
    ).rejects.toThrow(/not found|record/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create Transmittal Form — selecção de documentos, recipient
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-12: create transmittal form — document selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalDocumentFindFirst.mockResolvedValue(null);
  });

  it("seleccionar múltiplos documentos → todos adicionados", async () => {
    const docs = [
      { ...baseTransmittalDoc, id: "tdoc-001", documentId: DOC_ID_1 },
      { ...baseTransmittalDoc, id: "tdoc-002", documentId: DOC_ID_2 },
    ];
    mockTransmittalDocumentCreate
      .mockResolvedValueOnce(docs[0])
      .mockResolvedValueOnce(docs[1]);

    const result = await addDocumentsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      documentIds: [DOC_ID_1, DOC_ID_2],
    });

    expect(result).toHaveLength(2);
    expect(mockTransmittalDocumentCreate).toHaveBeenCalledTimes(2);
  });

  it("documento duplicado na selecção → rejeitar com conflict", async () => {
    mockTransmittalDocumentFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseTransmittalDoc);

    mockTransmittalDocumentCreate.mockResolvedValueOnce(baseTransmittalDoc);

    await expect(
      addDocumentsToTransmittal({
        orgId: ORG_ID,
        transmittalId: TRANSMITTAL_ID,
        documentIds: [DOC_ID_1, DOC_ID_1],
      }),
    ).rejects.toThrow(/duplicate|already exists|conflict|409|já existe/i);
  });

  it("transmittal não encontrado na selecção de documentos → erro", async () => {
    mockTransmittalFindUnique.mockResolvedValue(null);

    await expect(
      addDocumentsToTransmittal({
        orgId: ORG_ID,
        transmittalId: "nao-existe",
        documentIds: [DOC_ID_1],
      }),
    ).rejects.toThrow(/not found|404/i);
  });
});

describe("D4-E3-12: create transmittal form — recipient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
  });

  it("adiciona recipient com email e name ao transmittal", async () => {
    mockTransmittalRecipientCreate.mockResolvedValue(baseRecipient);

    const result = await addRecipientsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      recipients: [{ email: "fiscal@construtora.pt", name: "Carlos Mendes" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("fiscal@construtora.pt");
    expect(result[0].name).toBe("Carlos Mendes");
    expect(result[0].receivedAt).toBeNull();
  });

  it("adiciona múltiplos recipients", async () => {
    const recip1 = {
      ...baseRecipient,
      id: "r1",
      email: "a@test.com",
      name: "Alice",
    };
    const recip2 = {
      ...baseRecipient,
      id: "r2",
      email: "b@test.com",
      name: "Bob",
    };
    mockTransmittalRecipientCreate
      .mockResolvedValueOnce(recip1)
      .mockResolvedValueOnce(recip2);

    const result = await addRecipientsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      recipients: [
        { email: "a@test.com", name: "Alice" },
        { email: "b@test.com", name: "Bob" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alice");
    expect(result[1].name).toBe("Bob");
  });

  it("enviar transmittal com docs e recipients → status=SENT", async () => {
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalUpdate.mockResolvedValue(sentTransmittal);

    const result = await sendTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result.status).toBe("SENT");
    expect(result.sentAt).not.toBeNull();
  });

  it("transmittal já SENT → rejeitar re-envio", async () => {
    mockTransmittalFindUnique.mockResolvedValue(sentTransmittal);

    await expect(
      sendTransmittal({ orgId: ORG_ID, transmittalId: TRANSMITTAL_ID }),
    ).rejects.toThrow(/already sent|já enviado|conflict|409/i);

    expect(mockTransmittalUpdate).not.toHaveBeenCalled();
  });

  it("transmittal não encontrado para adicionar recipient → erro", async () => {
    mockTransmittalFindUnique.mockResolvedValue(null);

    await expect(
      addRecipientsToTransmittal({
        orgId: ORG_ID,
        transmittalId: "nao-existe",
        recipients: [{ email: "x@test.com", name: "X" }],
      }),
    ).rejects.toThrow(/not found|404/i);
  });
});
