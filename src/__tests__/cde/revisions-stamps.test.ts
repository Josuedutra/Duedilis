/**
 * CDE DocumentRevision + ValidationStamp — TDD red phase
 * Task: gov-1775321963106-xpvw4y (D4-E3-03v2)
 *
 * Tests DocumentRevision (versioning) and ValidationStamp (immutable stamps).
 *
 * Scenarios (7 mandatory):
 *  1. Criar revisão com revisionCode P01 (preliminary)
 *  2. Sequência correcta: P01 → P02 → A (approved) → B (revision)
 *  3. Cada revisão tem checksum SHA-256 do ficheiro
 *  4. ValidationStamp criado com payloadHash SHA-256 imutável
 *  5. Stamp não pode ser editado/deletado após criação (imutabilidade)
 *  6. getRevisionHistory() retorna lista ordenada por data
 *  7. currentRevisionCode no Document é actualizado automaticamente
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockDocumentRevisionCreate = vi.hoisted(() => vi.fn());
const mockDocumentRevisionFindMany = vi.hoisted(() => vi.fn());
const mockDocumentRevisionUpdate = vi.hoisted(() => vi.fn());
const mockDocumentRevisionDelete = vi.hoisted(() => vi.fn());
const mockValidationStampCreate = vi.hoisted(() => vi.fn());
const mockValidationStampUpdate = vi.hoisted(() => vi.fn());
const mockValidationStampDelete = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentRevision: {
      create: mockDocumentRevisionCreate,
      findMany: mockDocumentRevisionFindMany,
      update: mockDocumentRevisionUpdate,
      delete: mockDocumentRevisionDelete,
    },
    validationStamp: {
      create: mockValidationStampCreate,
      update: mockValidationStampUpdate,
      delete: mockValidationStampDelete,
    },
    document: {
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
    },
  },
}));

// Mock crypto for SHA-256
vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(
      () => "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    ),
  })),
}));

// Import functions under test (do not exist yet — TDD red phase)
import {
  createDocumentRevision,
  getRevisionHistory,
  createValidationStamp,
  updateValidationStamp,
  deleteValidationStamp,
} from "@/lib/actions/cde-revisions";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MOCK_SHA256 =
  "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

function mockRevision(revisionCode: string, createdAt: Date = new Date()) {
  return {
    id: `rev-${revisionCode}`,
    documentId: "doc-1",
    orgId: "org-1",
    revisionCode,
    fileChecksum: MOCK_SHA256,
    storageKey: `org-1/proj-1/folder-1/doc-1/rev-${revisionCode}/file.pdf`,
    createdById: "user-1",
    createdAt,
  };
}

function mockStamp(id = "stamp-1") {
  return {
    id,
    documentId: "doc-1",
    revisionId: "rev-P01",
    orgId: "org-1",
    payloadHash: MOCK_SHA256,
    stampedById: "user-1",
    createdAt: new Date(),
  };
}

// ─── Suite 1: Criar revisão P01 ───────────────────────────────────────────────
describe("createDocumentRevision — revisão inicial P01", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 1: Criar revisão com revisionCode P01
  it("deve criar revisão com revisionCode P01 e checksum SHA-256", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("P01"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "P01",
    });

    const result = await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "P01",
      fileBuffer: Buffer.from("dummy file content"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-P01/file.pdf",
    });

    expect(result.revisionCode).toBe("P01");
    expect(result.fileChecksum).toBe(MOCK_SHA256);
    expect(mockDocumentRevisionCreate).toHaveBeenCalledOnce();
    expect(mockDocumentRevisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "doc-1",
          revisionCode: "P01",
          fileChecksum: MOCK_SHA256,
        }),
      }),
    );
  });
});

// ─── Suite 2: Sequência de revisões ──────────────────────────────────────────
describe("createDocumentRevision — sequência correcta P01 → P02 → A → B", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 2a: P01 → P02
  it("deve permitir sequência P01 → P02", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "P01",
    });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("P02"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "P02",
    });

    const result = await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "P02",
      fileBuffer: Buffer.from("updated content v2"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-P02/file.pdf",
    });

    expect(result.revisionCode).toBe("P02");
  });

  // Cenário 2b: P02 → A (approved)
  it("deve permitir sequência P02 → A (approved)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "P02",
    });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("A"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "A",
    });

    const result = await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "A",
      fileBuffer: Buffer.from("approved content"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-A/file.pdf",
    });

    expect(result.revisionCode).toBe("A");
  });

  // Cenário 2c: A → B (revision after approval)
  it("deve permitir sequência A → B (revisão pós-aprovação)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "A",
    });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("B"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "B",
    });

    const result = await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "B",
      fileBuffer: Buffer.from("revised content"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-B/file.pdf",
    });

    expect(result.revisionCode).toBe("B");
  });
});

// ─── Suite 3: Checksum SHA-256 ────────────────────────────────────────────────
describe("createDocumentRevision — checksum SHA-256", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 3: Cada revisão tem checksum SHA-256 do ficheiro
  it("deve calcular e armazenar SHA-256 do conteúdo do ficheiro", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("P01"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "P01",
    });

    const result = await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "P01",
      fileBuffer: Buffer.from("file content for checksum"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-P01/file.pdf",
    });

    // fileChecksum deve ser um SHA-256 hex (64 chars)
    expect(result.fileChecksum).toMatch(/^[a-f0-9]{64}$/i);
    expect(mockDocumentRevisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileChecksum: expect.stringMatching(/^[a-f0-9]{64}$/i),
        }),
      }),
    );
  });
});

// ─── Suite 4: ValidationStamp criação ────────────────────────────────────────
describe("createValidationStamp — stamp imutável com payloadHash", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 4: ValidationStamp criado com payloadHash SHA-256 imutável
  it("deve criar ValidationStamp com payloadHash SHA-256", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockValidationStampCreate.mockResolvedValue(mockStamp());

    const result = await createValidationStamp({
      documentId: "doc-1",
      revisionId: "rev-P01",
      payload: { action: "APPROVED", note: "Aprovado pelo técnico" },
    });

    expect(result.payloadHash).toBe(MOCK_SHA256);
    expect(mockValidationStampCreate).toHaveBeenCalledOnce();
    expect(mockValidationStampCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "doc-1",
          revisionId: "rev-P01",
          payloadHash: MOCK_SHA256,
        }),
      }),
    );
  });
});

// ─── Suite 5: Imutabilidade do stamp ─────────────────────────────────────────
describe("ValidationStamp — imutabilidade após criação", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 5a: Stamp não pode ser editado
  it("deve rejeitar tentativa de editar ValidationStamp existente", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(
      updateValidationStamp({
        stampId: "stamp-1",
        payload: { action: "MODIFIED" },
      }),
    ).rejects.toThrow(/imutável|immutable|não permitido|cannot.*edit/i);

    expect(mockValidationStampUpdate).not.toHaveBeenCalled();
  });

  // Cenário 5b: Stamp não pode ser deletado
  it("deve rejeitar tentativa de deletar ValidationStamp existente", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(deleteValidationStamp({ stampId: "stamp-1" })).rejects.toThrow(
      /imutável|immutable|não permitido|cannot.*delete/i,
    );

    expect(mockValidationStampDelete).not.toHaveBeenCalled();
  });
});

// ─── Suite 6: getRevisionHistory ordenada ────────────────────────────────────
describe("getRevisionHistory — lista ordenada por data", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 6: getRevisionHistory() retorna lista ordenada por data
  it("deve retornar lista de revisões ordenadas por createdAt ascendente", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const now = new Date();
    const revisions = [
      mockRevision("P01", new Date(now.getTime() - 3000)),
      mockRevision("P02", new Date(now.getTime() - 2000)),
      mockRevision("A", new Date(now.getTime() - 1000)),
    ];
    mockDocumentRevisionFindMany.mockResolvedValue(revisions);

    const result = await getRevisionHistory({ documentId: "doc-1" });

    expect(result).toHaveLength(3);
    expect(result[0].revisionCode).toBe("P01");
    expect(result[1].revisionCode).toBe("P02");
    expect(result[2].revisionCode).toBe("A");
    expect(mockDocumentRevisionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentId: "doc-1" }),
        orderBy: expect.objectContaining({ createdAt: "asc" }),
      }),
    );
  });

  it("deve retornar lista vazia se documento não tem revisões", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentRevisionFindMany.mockResolvedValue([]);

    const result = await getRevisionHistory({ documentId: "doc-sem-revisoes" });

    expect(result).toEqual([]);
  });
});

// ─── Suite 7: currentRevisionCode actualizado automaticamente ────────────────
describe("createDocumentRevision — actualiza currentRevisionCode no Document", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 7: currentRevisionCode no Document é actualizado automaticamente
  it("deve actualizar currentRevisionCode no Document após criar nova revisão", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("P01"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "P01",
    });

    await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "P01",
      fileBuffer: Buffer.from("initial file"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-P01/file.pdf",
    });

    expect(mockDocumentUpdate).toHaveBeenCalledOnce();
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "doc-1" }),
        data: expect.objectContaining({ currentRevisionCode: "P01" }),
      }),
    );
  });

  it("deve actualizar currentRevisionCode para B após sequência completa", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "A",
    });
    mockDocumentRevisionCreate.mockResolvedValue(mockRevision("B"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      currentRevisionCode: "B",
    });

    await createDocumentRevision({
      documentId: "doc-1",
      revisionCode: "B",
      fileBuffer: Buffer.from("revision B content"),
      storageKey: "org-1/proj-1/folder-1/doc-1/rev-B/file.pdf",
    });

    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "doc-1" }),
        data: expect.objectContaining({ currentRevisionCode: "B" }),
      }),
    );
  });
});
