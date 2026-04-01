/**
 * ISO 19650 normalizeDocumentName service tests — Sprint D2
 * Task: gov-1775041253896-v20gul
 *
 * Testes para normalizeDocumentName (iso-normalization.ts):
 *  - Planta_Piso2_Rev3.pdf → discipline=AR, docType=DR, revision=P03
 *  - foto_obra.jpg → confidence < 0.5, isoName null
 *  - JSON parse failure → isoName null, confidence 0
 *  - Unknown discipline/docType codes → null validation
 *  - Confidence clamped to [0, 1]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist Anthropic mock ─────────────────────────────────────────────────────

const mockAnthropicCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => {
  function AnthropicMock() {
    return { messages: { create: mockAnthropicCreate } };
  }
  AnthropicMock.prototype = {};
  return { default: AnthropicMock };
});

// ─── Import after mocks ───────────────────────────────────────────────────────

import { normalizeDocumentName } from "@/lib/services/iso-normalization";

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

    expect(result.discipline).toBeNull();
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
