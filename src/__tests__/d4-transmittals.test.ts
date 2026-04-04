// D4-E3-09: Transmittals Tests — create, add docs, send, receipt, ZIP presigned
// Task: gov-1775310336190-6fjn4e
// TDD red phase — tests MUST fail until D4-09 implements Transmittal actions.
//
// Cenários:
//  1. Create transmittal: subject + notes → status=DRAFT
//  2. Add documents: addDocumentsToTransmittal(id, [docId1, docId2])
//  3. Add recipients: addRecipients(id, [{email, name}])
//  4. Send: sendTransmittal() → status=SENT, sentAt preenchido
//  5. Receipt: markReceived(recipientId) → receivedAt preenchido
//  6. Presigned URLs: getTransmittalPresignedUrls(id) → URL por doc
//  7. Duplicate doc: mesmo doc 2x → rejeitar (unique)

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockTransmittalCreate = vi.hoisted(() => vi.fn());
const mockTransmittalFindUnique = vi.hoisted(() => vi.fn());
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

// Import functions (do not exist yet — red phase)
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
  subject: "Transmittal de Aprovação",
  notes: "Documentos para revisão",
  status: "DRAFT",
  sentAt: null,
  createdAt: new Date("2026-04-04T00:00:00Z"),
  updatedAt: new Date("2026-04-04T00:00:00Z"),
};

const baseRecipient = {
  id: RECIPIENT_ID,
  transmittalId: TRANSMITTAL_ID,
  email: "recipient@example.com",
  name: "John Doe",
  receivedAt: null,
};

const baseTransmittalDoc = {
  id: "tdoc-001",
  transmittalId: TRANSMITTAL_ID,
  documentId: DOC_ID_1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 1: Create transmittal → status=DRAFT
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: createTransmittal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("cria transmittal com subject e notes → status=DRAFT", async () => {
    mockTransmittalCreate.mockResolvedValue(baseTransmittal);

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Transmittal de Aprovação",
      notes: "Documentos para revisão",
    });

    expect(result.status).toBe("DRAFT");
    expect(result.subject).toBe("Transmittal de Aprovação");
    expect(result.sentAt).toBeNull();
    expect(mockTransmittalCreate).toHaveBeenCalledTimes(1);
  });

  it("cria transmittal sem notes → status=DRAFT", async () => {
    const noNotes = { ...baseTransmittal, notes: null };
    mockTransmittalCreate.mockResolvedValue(noNotes);

    const result = await createTransmittal({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      subject: "Transmittal sem notes",
    });

    expect(result.status).toBe("DRAFT");
    expect(mockTransmittalCreate).toHaveBeenCalledTimes(1);
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
// Cenário 2: Add documents → addDocumentsToTransmittal
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: addDocumentsToTransmittal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
    mockTransmittalDocumentFindFirst.mockResolvedValue(null); // sem duplicatas
  });

  it("adiciona dois documentos ao transmittal", async () => {
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
    expect(mockTransmittalDocumentCreate).toHaveBeenCalledTimes(2);
  });

  it("transmittal não encontrado → rejeitar", async () => {
    mockTransmittalFindUnique.mockResolvedValue(null);

    await expect(
      addDocumentsToTransmittal({
        orgId: ORG_ID,
        transmittalId: "nonexistent",
        documentIds: [DOC_ID_1],
      }),
    ).rejects.toThrow(/not found|404|não encontrado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 3: Add recipients → addRecipientsToTransmittal
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: addRecipientsToTransmittal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
  });

  it("adiciona recipientes com email e name", async () => {
    const recip1 = {
      ...baseRecipient,
      id: "recip-001",
      email: "a@example.com",
      name: "Alice",
    };
    const recip2 = {
      ...baseRecipient,
      id: "recip-002",
      email: "b@example.com",
      name: "Bob",
    };
    mockTransmittalRecipientCreate
      .mockResolvedValueOnce(recip1)
      .mockResolvedValueOnce(recip2);

    const result = await addRecipientsToTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
      recipients: [
        { email: "a@example.com", name: "Alice" },
        { email: "b@example.com", name: "Bob" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("a@example.com");
    expect(result[1].name).toBe("Bob");
    expect(mockTransmittalRecipientCreate).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 4: Send transmittal → status=SENT, sentAt preenchido
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: sendTransmittal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
  });

  it("envia transmittal → status=SENT, sentAt preenchido", async () => {
    const sentAt = new Date("2026-04-04T10:00:00Z");
    const sentTransmittal = { ...baseTransmittal, status: "SENT", sentAt };
    mockTransmittalUpdate.mockResolvedValue(sentTransmittal);

    const result = await sendTransmittal({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result.status).toBe("SENT");
    expect(result.sentAt).not.toBeNull();
    expect(mockTransmittalUpdate).toHaveBeenCalledTimes(1);
  });

  it("transmittal já SENT → rejeitar (idempotent guard)", async () => {
    const sentTransmittal = {
      ...baseTransmittal,
      status: "SENT",
      sentAt: new Date(),
    };
    mockTransmittalFindUnique.mockResolvedValue(sentTransmittal);

    await expect(
      sendTransmittal({
        orgId: ORG_ID,
        transmittalId: TRANSMITTAL_ID,
      }),
    ).rejects.toThrow(/already sent|já enviado|conflict|409/i);

    expect(mockTransmittalUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 5: Receipt → markReceived → receivedAt preenchido
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: markReceived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("markReceived → receivedAt preenchido", async () => {
    const receivedAt = new Date("2026-04-04T12:00:00Z");
    const updatedRecipient = { ...baseRecipient, receivedAt };
    mockTransmittalRecipientUpdate.mockResolvedValue(updatedRecipient);

    const result = await markReceived({
      orgId: ORG_ID,
      recipientId: RECIPIENT_ID,
    });

    expect(result.receivedAt).not.toBeNull();
    expect(mockTransmittalRecipientUpdate).toHaveBeenCalledTimes(1);
  });

  it("recipiente não encontrado → rejeitar", async () => {
    mockTransmittalRecipientUpdate.mockRejectedValue(
      new Error("Record not found"),
    );

    await expect(
      markReceived({
        orgId: ORG_ID,
        recipientId: "nonexistent-recip",
      }),
    ).rejects.toThrow(/not found|404|não encontrado|record/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 6: Presigned URLs → getTransmittalPresignedUrls → URL por doc
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: getTransmittalPresignedUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
  });

  it("retorna URL presigned por documento", async () => {
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

  it("transmittal sem documentos → array vazio", async () => {
    mockTransmittalDocumentFindMany.mockResolvedValue([]);

    const result = await getTransmittalPresignedUrls({
      orgId: ORG_ID,
      transmittalId: TRANSMITTAL_ID,
    });

    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 7: Duplicate doc → rejeitar (unique constraint)
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-09: addDocumentsToTransmittal — duplicate doc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockTransmittalFindUnique.mockResolvedValue(baseTransmittal);
  });

  it("mesmo doc 2x → rejeitar (unique constraint)", async () => {
    // First call: no duplicate. Second call: duplicate found.
    mockTransmittalDocumentFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseTransmittalDoc); // doc already exists

    mockTransmittalDocumentCreate.mockResolvedValueOnce(baseTransmittalDoc);

    await expect(
      addDocumentsToTransmittal({
        orgId: ORG_ID,
        transmittalId: TRANSMITTAL_ID,
        documentIds: [DOC_ID_1, DOC_ID_1], // same doc twice
      }),
    ).rejects.toThrow(/duplicate|already exists|conflict|409|já existe/i);
  });

  it("doc diferente no mesmo transmittal → permitir", async () => {
    mockTransmittalDocumentFindFirst.mockResolvedValue(null); // no duplicates
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
    expect(mockTransmittalDocumentCreate).toHaveBeenCalledTimes(2);
  });
});
