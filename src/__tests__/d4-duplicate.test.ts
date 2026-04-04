// D4-E3-04: Duplicate Detection Tests — contentHash warning, semanticKey 409
// Task: gov-1775310295014-592yhw
// TDD red phase — tests MUST fail until D4-04 implements the detection logic.
//
// Cenários:
//  1. contentHash match → warning (sugere revisão, NÃO bloqueia)
//  2. semanticKey match → 409 Conflict (bloqueia upload)
//  3. Sem duplicata → clean (upload procede normalmente)

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────
const mockDocumentFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: mockDocumentFindFirst,
    },
  },
}));

import { checkDuplicateDocument } from "@/lib/actions/duplicate-detection";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-test-001";
const SEMANTIC_KEY = "estrutural-planta-piso0";
const CONTENT_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const existingDocById = {
  id: "doc-existing-001",
  contentHash: CONTENT_HASH,
  semanticKey: SEMANTIC_KEY,
  projectId: PROJECT_ID,
};

// ─── 1. contentHash match → warning ──────────────────────────────────────────

describe("D4-E3-04: Duplicate Detection — contentHash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns warning when contentHash matches an existing document", async () => {
    // First findFirst (by contentHash) returns a match
    mockDocumentFindFirst.mockResolvedValueOnce(existingDocById);

    const result = await checkDuplicateDocument({
      fileBuffer: Buffer.from("test content"),
      contentHash: CONTENT_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("warning");
    expect(result.existingDocId).toBe("doc-existing-001");
    // Should NOT return a 409 conflict for hash-only matches
    expect(result).not.toHaveProperty("status");
  });

  it("queries prisma.document.findFirst with correct contentHash and projectId", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(existingDocById);

    await checkDuplicateDocument({
      fileBuffer: Buffer.from("test content"),
      contentHash: CONTENT_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(mockDocumentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contentHash: CONTENT_HASH,
          projectId: PROJECT_ID,
        }),
      }),
    );
  });
});

// ─── 2. semanticKey match → 409 Conflict ────────────────────────────────────

describe("D4-E3-04: Duplicate Detection — semanticKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 conflict when semanticKey matches an existing document", async () => {
    // First findFirst (by contentHash) returns null — no hash match
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    // Second findFirst (by semanticKey) returns a match
    mockDocumentFindFirst.mockResolvedValueOnce({
      id: "doc-semantic-001",
      contentHash: "different-hash",
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    const result = await checkDuplicateDocument({
      fileBuffer: Buffer.from("different content"),
      contentHash: "different-hash",
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("conflict");
    expect(result.status).toBe(409);
    expect(result.existingDocId).toBe("doc-semantic-001");
  });

  it("queries prisma.document.findFirst with correct semanticKey and projectId", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no hash match
    mockDocumentFindFirst.mockResolvedValueOnce({
      id: "doc-semantic-002",
      contentHash: "another-hash",
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    await checkDuplicateDocument({
      fileBuffer: Buffer.from("another content"),
      contentHash: "another-hash",
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

// ─── 3. Sem duplicata → clean ────────────────────────────────────────────────

describe("D4-E3-04: Duplicate Detection — clean (sem duplicata)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns clean when neither contentHash nor semanticKey match", async () => {
    // Both findFirst calls return null
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce(null);

    const result = await checkDuplicateDocument({
      fileBuffer: Buffer.from("brand new content"),
      contentHash: "unique-hash-xyz",
      semanticKey: "unico-documento-novo",
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("clean");
    expect(result).not.toHaveProperty("existingDocId");
    expect(result).not.toHaveProperty("status");
  });

  it("calls findFirst twice (contentHash then semanticKey) when no match found", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce(null);

    await checkDuplicateDocument({
      fileBuffer: Buffer.from("another unique content"),
      contentHash: "unique-hash-abc",
      semanticKey: "outro-documento-unico",
      projectId: PROJECT_ID,
    });

    expect(mockDocumentFindFirst).toHaveBeenCalledTimes(2);
  });
});

// ─── 4. Prioridade: contentHash tem precedência sobre semanticKey ─────────────

describe("D4-E3-04: Duplicate Detection — precedência contentHash > semanticKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns warning (not conflict) when both hash and semantic key match", async () => {
    // When contentHash matches, should return warning immediately (sem verificar semanticKey)
    mockDocumentFindFirst.mockResolvedValueOnce(existingDocById);
    // If semanticKey were checked, it would also match — but should NOT be checked
    mockDocumentFindFirst.mockResolvedValueOnce(existingDocById);

    const result = await checkDuplicateDocument({
      fileBuffer: Buffer.from("test content"),
      contentHash: CONTENT_HASH,
      semanticKey: SEMANTIC_KEY,
      projectId: PROJECT_ID,
    });

    // contentHash match wins — warning, not conflict
    expect(result.type).toBe("warning");
    // Should only call findFirst once (short-circuit after hash match)
    expect(mockDocumentFindFirst).toHaveBeenCalledTimes(1);
  });
});
