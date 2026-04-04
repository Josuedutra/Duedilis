/**
 * CDE Duplicate Detection — TDD red phase
 * Task: gov-1775321969138-91p9qd (D4-E3-04v2)
 *
 * Tests duplicate detection via contentHash (warning) and semanticKey (409 Conflict).
 *
 * Scenarios (4 mandatory):
 *  1. Upload com contentHash duplicado → retorna warning (200 + warning)
 *  2. Upload com semanticKey duplicado (mesmo discipline-docType-zone) → retorna 409 Conflict
 *  3. Upload sem duplicados → retorna clean (201 Created path)
 *  4. Server recalcula hash do ficheiro (não confia no hash do client)
 */

import { createHash } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockDocumentFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: mockDocumentFindFirst,
    },
  },
}));

import { checkDuplicateDocument } from "@/lib/actions/duplicate-detection";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-cde-dup-001";
const FILE_CONTENT = Buffer.from("planta-piso0-v1.pdf-conteudo-original");
const COMPUTED_HASH = sha256(FILE_CONTENT);
const SEMANTIC_KEY = "estrutural-planta-piso0";

const existingDoc = {
  id: "doc-existing-cde-001",
  contentHash: COMPUTED_HASH,
  semanticKey: SEMANTIC_KEY,
  projectId: PROJECT_ID,
};

// ─── 1. contentHash duplicado → warning ──────────────────────────────────────

describe("CDE Duplicate Detection — contentHash match → warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns warning when contentHash matches an existing document", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(existingDoc);

    const result = await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT,
      contentHash: COMPUTED_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("warning");
    expect(result).toMatchObject({
      type: "warning",
      existingDocId: existingDoc.id,
    });
    // warning is NOT a hard block — no 409 status
    expect(result).not.toHaveProperty("status");
  });

  it("queries prisma with contentHash and projectId", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(existingDoc);

    await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT,
      contentHash: COMPUTED_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(mockDocumentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contentHash: COMPUTED_HASH,
          projectId: PROJECT_ID,
        }),
      }),
    );
  });
});

// ─── 2. semanticKey duplicado → 409 Conflict ────────────────────────────────

describe("CDE Duplicate Detection — semanticKey match → 409 Conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const differentContent = Buffer.from(
    "planta-piso0-v2.pdf-conteudo-diferente",
  );
  const differentHash = sha256(differentContent);

  it("returns 409 conflict when semanticKey matches but contentHash does not", async () => {
    // No contentHash match
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    // semanticKey match
    mockDocumentFindFirst.mockResolvedValueOnce({
      id: "doc-semantic-cde-001",
      contentHash: COMPUTED_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    const result = await checkDuplicateDocument({
      fileBuffer: differentContent,
      contentHash: differentHash,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("conflict");
    expect(result).toMatchObject({
      type: "conflict",
      status: 409,
      existingDocId: "doc-semantic-cde-001",
    });
  });

  it("queries prisma with semanticKey and projectId for the second check", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce({
      id: "doc-semantic-cde-002",
      contentHash: COMPUTED_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    await checkDuplicateDocument({
      fileBuffer: differentContent,
      contentHash: differentHash,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(mockDocumentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          semanticKey: SEMANTIC_KEY,
          projectId: PROJECT_ID,
        }),
      }),
    );
  });
});

// ─── 3. Sem duplicados → clean (201 Created path) ────────────────────────────

describe("CDE Duplicate Detection — sem duplicados → clean", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const freshContent = Buffer.from("novo-documento-unico-sem-precedente.pdf");
  const freshHash = sha256(freshContent);

  it("returns clean when neither contentHash nor semanticKey match", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no hash match
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no semantic match

    const result = await checkDuplicateDocument({
      fileBuffer: freshContent,
      contentHash: freshHash,
      semanticKey: "novo-docType-zonaX",
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("clean");
    expect(result).not.toHaveProperty("existingDocId");
    expect(result).not.toHaveProperty("status");
  });

  it("calls findFirst exactly twice (contentHash then semanticKey) when clean", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce(null);

    await checkDuplicateDocument({
      fileBuffer: freshContent,
      contentHash: freshHash,
      semanticKey: "outro-docType-zonaY",
      projectId: PROJECT_ID,
    });

    expect(mockDocumentFindFirst).toHaveBeenCalledTimes(2);
  });
});

// ─── 4. Server recalcula hash do ficheiro (não confia no hash do client) ─────

describe("CDE Duplicate Detection — server recalcula hash (não confia no client)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RED PHASE: server currently trusts client hash — D4-04 must compute hash from fileBuffer
  // Expected to fail until D4-04 implements server-side hash recomputation.
  it.fails(
    "uses hash computed from fileBuffer, not the client-supplied contentHash",
    async () => {
      const fileContent = Buffer.from("conteudo-real-do-ficheiro");
      const serverComputedHash = sha256(fileContent);
      const maliciousClientHash =
        "0000000000000000000000000000000000000000000000000000000000000000";

      mockDocumentFindFirst.mockResolvedValueOnce(null);
      mockDocumentFindFirst.mockResolvedValueOnce(null);

      await checkDuplicateDocument({
        fileBuffer: fileContent,
        contentHash: maliciousClientHash, // client sends a fake hash
        semanticKey: "estrutural-corte-piso1",
        projectId: PROJECT_ID,
      });

      // The first findFirst call (contentHash lookup) should use the SERVER-computed hash
      // NOT the malicious client-supplied hash
      const firstCall = mockDocumentFindFirst.mock.calls[0][0];
      expect(firstCall.where.contentHash).toBe(serverComputedHash);
      expect(firstCall.where.contentHash).not.toBe(maliciousClientHash);
    },
  );

  it("computes SHA-256 hash from fileBuffer bytes consistently", async () => {
    const content = Buffer.from("ficheiro-de-teste-hash-consistente");
    const expectedHash = sha256(content);

    mockDocumentFindFirst.mockResolvedValueOnce({
      id: "doc-hash-check",
      contentHash: expectedHash,
      semanticKey: "arq-planta-piso2",
      projectId: PROJECT_ID,
    });

    const result = await checkDuplicateDocument({
      fileBuffer: content,
      contentHash: expectedHash, // matches server-computed hash
      semanticKey: "arq-planta-piso2",
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("warning");
    expect(result).toMatchObject({ existingDocId: "doc-hash-check" });
  });
});
