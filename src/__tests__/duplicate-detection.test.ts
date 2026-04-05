/**
 * Duplicate Detection — QA Fix Tests
 * Task: gov-1775349151469-buh8ta (D4-E3-04v2-fix)
 *
 * Scenarios:
 *  1. contentHash stored = serverComputedHash (not raw input.fileHash)
 *     — upload same file twice → 2nd upload returns warning with matching contentHash
 *  2. Duplicate detection returns existing document metadata when hash matches
 *  3. Non-duplicate upload creates new document without warnings
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-dup-fix-001";
const FILE_CONTENT = Buffer.from("documento-original-conteudo.pdf");
const SERVER_COMPUTED_HASH = sha256(FILE_CONTENT);

const existingDoc = {
  id: "doc-existing-001",
  contentHash: SERVER_COMPUTED_HASH,
  semanticKey: "arq-planta-piso1",
  projectId: PROJECT_ID,
  fileName: "planta-piso1.pdf",
  status: "ACTIVE",
};

// ─── 1. Server stores serverComputedHash, not raw input.fileHash ─────────────

describe("Duplicate Detection — contentHash = serverComputedHash (not input.fileHash)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores and queries using server-computed hash, ignoring client-supplied fileHash", async () => {
    const clientSuppliedHash =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce(null);

    await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT,
      contentHash: clientSuppliedHash, // client sends different hash
      semanticKey: "arq-planta-piso1",
      projectId: PROJECT_ID,
    });

    // The findFirst call MUST use SERVER_COMPUTED_HASH, not clientSuppliedHash
    const firstCall = mockDocumentFindFirst.mock.calls[0][0];
    expect(firstCall.where.contentHash).toBe(SERVER_COMPUTED_HASH);
    expect(firstCall.where.contentHash).not.toBe(clientSuppliedHash);
  });

  it("upload same file twice → 2nd upload returns warning with matching contentHash", async () => {
    // 1st upload: no duplicates found (clean)
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce(null);

    const firstUpload = await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT,
      contentHash: SERVER_COMPUTED_HASH,
      semanticKey: "arq-planta-piso1",
      projectId: PROJECT_ID,
    });

    expect(firstUpload.type).toBe("clean");

    // 2nd upload: same file content → contentHash match → warning
    mockDocumentFindFirst.mockResolvedValueOnce(existingDoc);

    const secondUpload = await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT, // same file bytes
      contentHash: SERVER_COMPUTED_HASH, // same hash
      semanticKey: "arq-planta-piso1",
      projectId: PROJECT_ID,
    });

    expect(secondUpload.type).toBe("warning");
    // The warning must include the matching contentHash via existingDocId
    expect(secondUpload).toMatchObject({
      type: "warning",
      existingDocId: existingDoc.id,
    });
  });
});

// ─── 2. Duplicate detection returns existing document metadata ────────────────

describe("Duplicate Detection — returns existing document metadata on hash match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existingDocId from the matched document record", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(existingDoc);

    const result = await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT,
      contentHash: SERVER_COMPUTED_HASH,
      semanticKey: existingDoc.semanticKey,
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("warning");
    if (result.type === "warning") {
      expect(result.existingDocId).toBe(existingDoc.id);
    }
  });

  it("queries with both contentHash and projectId to scope to the correct project", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(existingDoc);

    await checkDuplicateDocument({
      fileBuffer: FILE_CONTENT,
      contentHash: SERVER_COMPUTED_HASH,
      semanticKey: existingDoc.semanticKey,
      projectId: PROJECT_ID,
    });

    expect(mockDocumentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contentHash: SERVER_COMPUTED_HASH,
          projectId: PROJECT_ID,
        }),
      }),
    );
  });
});

// ─── 3. Non-duplicate upload creates new document without warnings ────────────

describe("Duplicate Detection — non-duplicate returns clean (no warnings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const newContent = Buffer.from("documento-completamente-novo-unico.pdf");
  const newHash = sha256(newContent);

  it("returns clean when no contentHash or semanticKey match exists", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no hash match
    mockDocumentFindFirst.mockResolvedValueOnce(null); // no semantic match

    const result = await checkDuplicateDocument({
      fileBuffer: newContent,
      contentHash: newHash,
      semanticKey: "hidraulica-detalhe-escada",
      projectId: PROJECT_ID,
    });

    expect(result.type).toBe("clean");
    expect(result).not.toHaveProperty("existingDocId");
    expect(result).not.toHaveProperty("status");
  });

  it("does not return warning or conflict for unique content", async () => {
    mockDocumentFindFirst.mockResolvedValueOnce(null);
    mockDocumentFindFirst.mockResolvedValueOnce(null);

    const result = await checkDuplicateDocument({
      fileBuffer: newContent,
      contentHash: newHash,
      semanticKey: "eletrica-diagrama-quadro",
      projectId: PROJECT_ID,
    });

    expect(result.type).not.toBe("warning");
    expect(result.type).not.toBe("conflict");
    expect(result.type).toBe("clean");
  });
});
