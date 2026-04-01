/**
 * ISO 19650 Normalization tests — Sprint D2
 * Task: gov-1775041253896-v20gul
 *
 * Testes:
 *  - Planta_Piso2_Rev3.pdf → discipline=AR, docType=DR, revision=P03
 *  - foto_obra.jpg → confidence < 0.5, isoName null
 *  - Status transition PENDING → NORMALIZING → READY
 *  - Status reverts to PENDING on error
 *  - triggerDocumentNormalization no-ops for non-PENDING docs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────

const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => vi.fn());
const mockAnthropicCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => {
  function AnthropicMock() {
    return { messages: { create: mockAnthropicCreate } };
  }
  AnthropicMock.prototype = {};
  return { default: AnthropicMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
    },
    auditLog: {
      findFirst: mockAuditLogFindFirst.mockResolvedValue(null),
      create: mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" }),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

// Mock r2 to avoid env issues
vi.mock("@/lib/services/r2", () => ({
  generatePresignedUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: "https://r2-pending.example.com/test",
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { normalizeDocumentName } from "@/lib/services/iso-normalization";
import { triggerDocumentNormalization } from "@/lib/actions/upload-actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockHaikuResponse(json: object) {
  mockAnthropicCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(json) }],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeDocumentName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Planta_Piso2_Rev3.pdf → discipline=AR, docType=DR, revision=P03", async () => {
    mockHaikuResponse({
      isoName: "PRJ-AR-DR-ZZ-0001-P03",
      discipline: "AR",
      docType: "DR",
      revision: "P03",
      confidence: 0.85,
    });

    const result = await normalizeDocumentName({
      originalName: "Planta_Piso2_Rev3.pdf",
      projectCode: "PRJ",
      folderPath: "Arquitectura",
    });

    expect(result.discipline).toBe("AR");
    expect(result.docType).toBe("DR");
    expect(result.revision).toBe("P03");
    expect(result.isoName).toBe("PRJ-AR-DR-ZZ-0001-P03");
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("foto_obra.jpg → confidence < 0.5, isoName null", async () => {
    mockHaikuResponse({
      isoName: "PRJ-GE-DR-ZZ-0001-P01",
      discipline: "GE",
      docType: "DR",
      revision: "P01",
      confidence: 0.3,
    });

    const result = await normalizeDocumentName({
      originalName: "foto_obra.jpg",
      projectCode: "PRJ",
      folderPath: "Fotos",
    });

    expect(result.confidence).toBeLessThan(0.5);
    expect(result.isoName).toBeNull();
  });

  it("returns null isoName when Haiku JSON parse fails", async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "não é JSON válido" }],
    });

    const result = await normalizeDocumentName({
      originalName: "desenho.pdf",
      projectCode: "PRJ",
      folderPath: "Geral",
    });

    expect(result.isoName).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("validates discipline code — unknown code returns null", async () => {
    mockHaikuResponse({
      isoName: "PRJ-XX-DR-ZZ-0001-P01",
      discipline: "XX", // invalid
      docType: "DR",
      revision: "P01",
      confidence: 0.7,
    });

    const result = await normalizeDocumentName({
      originalName: "ficheiro.pdf",
      projectCode: "PRJ",
      folderPath: "Geral",
    });

    // discipline XX is not in the known codes → null
    expect(result.discipline).toBeNull();
    // isoName is still returned as-is from AI
    expect(result.isoName).toBe("PRJ-XX-DR-ZZ-0001-P01");
  });

  it("validates docType code — unknown code returns null", async () => {
    mockHaikuResponse({
      isoName: "PRJ-AR-ZZ-ZZ-0001-P01",
      discipline: "AR",
      docType: "ZZ", // invalid
      revision: "P01",
      confidence: 0.75,
    });

    const result = await normalizeDocumentName({
      originalName: "ficheiro.pdf",
      projectCode: "PRJ",
      folderPath: "Geral",
    });

    expect(result.docType).toBeNull();
  });

  it("clamps confidence to [0, 1]", async () => {
    mockHaikuResponse({
      isoName: "PRJ-AR-DR-ZZ-0001-P01",
      discipline: "AR",
      docType: "DR",
      revision: "P01",
      confidence: 1.5, // out of range
    });

    const result = await normalizeDocumentName({
      originalName: "ficheiro.pdf",
      projectCode: "PRJ",
      folderPath: "Geral",
    });

    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("triggerDocumentNormalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseDoc = {
    id: "doc-001",
    originalName: "Planta_Piso1.pdf",
    orgId: "org-001",
    projectId: "proj-001",
    folderId: "folder-001",
    status: "PENDING",
    folder: { name: "Arquitectura" },
    project: { name: "EDIFICIO VANTIA" },
  };

  it("PENDING → NORMALIZING → READY on success", async () => {
    mockDocumentFindUnique.mockResolvedValueOnce(baseDoc);
    // First update: NORMALIZING
    mockDocumentUpdate.mockResolvedValueOnce({
      ...baseDoc,
      status: "NORMALIZING",
    });
    // Haiku response
    mockHaikuResponse({
      isoName: "EDIFICIOV-AR-DR-ZZ-0001-P01",
      discipline: "AR",
      docType: "DR",
      revision: "P01",
      confidence: 0.88,
    });
    // Second update: READY
    mockDocumentUpdate.mockResolvedValueOnce({ ...baseDoc, status: "READY" });

    await triggerDocumentNormalization("doc-001");

    // First call: set NORMALIZING
    expect(mockDocumentUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "doc-001" },
      data: { status: "NORMALIZING" },
    });
    // Second call: set READY with ISO fields
    expect(mockDocumentUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-001" },
      data: expect.objectContaining({
        status: "READY",
        discipline: "AR",
        docType: "DR",
        revision: "P01",
      }),
    });
  });

  it("reverts to PENDING if normalizeDocumentName throws", async () => {
    mockDocumentFindUnique.mockResolvedValueOnce(baseDoc);
    mockDocumentUpdate.mockResolvedValueOnce({
      ...baseDoc,
      status: "NORMALIZING",
    });
    mockAnthropicCreate.mockRejectedValueOnce(new Error("API timeout"));
    mockDocumentUpdate.mockResolvedValueOnce({ ...baseDoc, status: "PENDING" });

    await triggerDocumentNormalization("doc-001");

    // Should revert to PENDING
    expect(mockDocumentUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-001" },
      data: { status: "PENDING" },
    });
  });

  it("no-ops when document is not PENDING", async () => {
    mockDocumentFindUnique.mockResolvedValueOnce({
      ...baseDoc,
      status: "CONFIRMED",
    });

    await triggerDocumentNormalization("doc-001");

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when document not found", async () => {
    mockDocumentFindUnique.mockResolvedValueOnce(null);

    await triggerDocumentNormalization("doc-001");

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });
});
