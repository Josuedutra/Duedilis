/**
 * CDE Staging Page tests — Sprint D4, Task D4-E3-11
 * gov-1775311328428-k1t1mb
 *
 * Testes para a página /cde/staging:
 *  1. Reject action — requer reason, chama rejectDocument com reason
 *  2. Reject sem reason — lança erro de validação
 *  3. Empty state — listStagingDocuments retorna [] (sem documentos em staging)
 *  4. Múltiplos documentos — todos listados com dados correctos
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: mockDocumentFindMany,
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
    },
  },
}));

import {
  listStagingDocuments,
  rejectDocument,
} from "@/lib/actions/staging-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeDoc = (id: string, name: string) => ({
  id,
  originalName: name,
  isoName: null,
  status: "READY",
  orgId: "org-1",
  projectId: "proj-1",
  folderId: "folder-1",
  createdAt: new Date("2026-04-04T12:00:00Z"),
  uploader: { id: "user-1", name: "Bruno Silva", email: "bruno@test.com" },
});

// ─── 4. Reject action ─────────────────────────────────────────────────────────

describe("rejectDocument — reject action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("rejeita documento READY com reason obrigatória → REJECTED", async () => {
    mockDocumentFindUnique.mockResolvedValue(makeDoc("doc-1", "planta.pdf"));
    mockDocumentUpdate.mockResolvedValue({ id: "doc-1", status: "REJECTED" });

    const result = await rejectDocument({
      documentId: "doc-1",
      reason: "Nomenclatura não conforme ISO 19650",
    });

    expect(result.status).toBe("REJECTED");
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "REJECTED" },
      }),
    );
  });

  it("rejeitar sem reason — lança erro de validação", async () => {
    await expect(
      rejectDocument({ documentId: "doc-1", reason: "" }),
    ).rejects.toThrow("Motivo de rejeição obrigatório.");
  });

  it("rejeitar com reason só de espaços — lança erro de validação", async () => {
    await expect(
      rejectDocument({ documentId: "doc-1", reason: "   " }),
    ).rejects.toThrow("Motivo de rejeição obrigatório.");
  });

  it("documento não encontrado — lança erro", async () => {
    mockDocumentFindUnique.mockResolvedValue(null);

    await expect(
      rejectDocument({ documentId: "nao-existe", reason: "motivo válido" }),
    ).rejects.toThrow("Documento não encontrado.");
  });

  it("documento não está em READY — rejeita transição", async () => {
    mockDocumentFindUnique.mockResolvedValue({
      ...makeDoc("doc-1", "planta.pdf"),
      status: "CONFIRMED",
    });

    await expect(
      rejectDocument({ documentId: "doc-1", reason: "motivo" }),
    ).rejects.toThrow(/READY/);
  });
});

// ─── 5. Empty state ───────────────────────────────────────────────────────────

describe("listStagingDocuments — empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("retorna array vazio quando não há documentos em staging", async () => {
    mockDocumentFindMany.mockResolvedValue([]);

    const result = await listStagingDocuments({
      orgId: "org-1",
      projectId: "proj-1",
    });

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("múltiplos documentos — todos listados com dados correctos", async () => {
    const docs = [
      makeDoc("doc-a", "ARQ-001.pdf"),
      makeDoc("doc-b", "EST-002.pdf"),
      makeDoc("doc-c", "MEP-003.pdf"),
    ];
    mockDocumentFindMany.mockResolvedValue(docs);

    const result = await listStagingDocuments({
      orgId: "org-1",
      projectId: "proj-1",
    });

    expect(result).toHaveLength(3);
    expect(result.map((d) => d.originalName)).toEqual([
      "ARQ-001.pdf",
      "EST-002.pdf",
      "MEP-003.pdf",
    ]);
    result.forEach((d) => {
      expect(d.uploadedBy.name).toBe("Bruno Silva");
      expect(d.uploadedAt).toBe("2026-04-04T12:00:00.000Z");
    });
  });
});
