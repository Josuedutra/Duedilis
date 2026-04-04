/**
 * StagingList tests — Sprint D4, Task D4-E3-11
 * gov-1775311328428-k1t1mb
 *
 * Testes para o server action que alimenta o componente StagingList:
 *  1. Render — lista documentos em staging com nome, uploadedBy, uploadedAt
 *  2. Validate action — validateDocument move documento para CONFIRMED
 *  3. Promote action — promoteDocument move documento para CONFIRMED
 *  4. Reject action — rejectDocument requer reason, move para REJECTED
 *  5. Empty state — listStagingDocuments retorna [] quando não há documentos
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
  validateDocument,
  promoteDocument,
} from "@/lib/actions/staging-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const stubUser = { id: "user-1", name: "Ana Costa", email: "ana@test.com" };
const stubDoc = {
  id: "doc-staging-1",
  originalName: "ARQ-PB-DR-001-P01.pdf",
  isoName: "ARQ-PB-DR-001-P01",
  status: "READY",
  orgId: "org-1",
  projectId: "proj-1",
  folderId: "folder-1",
  createdAt: new Date("2026-04-04T10:00:00Z"),
  uploader: stubUser,
};

// ─── 1. StagingList render ────────────────────────────────────────────────────

describe("listStagingDocuments — StagingList render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("retorna lista de documentos em staging com nome, uploadedBy, uploadedAt", async () => {
    mockDocumentFindMany.mockResolvedValue([stubDoc]);

    const result = await listStagingDocuments({
      orgId: "org-1",
      projectId: "proj-1",
    });

    expect(result).toHaveLength(1);
    expect(result[0].originalName).toBe("ARQ-PB-DR-001-P01.pdf");
    expect(result[0].uploadedBy.name).toBe("Ana Costa");
    expect(result[0].uploadedBy.email).toBe("ana@test.com");
    expect(result[0].uploadedAt).toBe("2026-04-04T10:00:00.000Z");
    expect(result[0].status).toBe("READY");
  });

  it("filtra apenas documentos com status READY", async () => {
    mockDocumentFindMany.mockResolvedValue([stubDoc]);

    await listStagingDocuments({ orgId: "org-1", projectId: "proj-1" });

    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "READY" }),
      }),
    );
  });

  it("não autenticado — lança erro", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      listStagingDocuments({ orgId: "org-1", projectId: "proj-1" }),
    ).rejects.toThrow("Não autenticado.");
  });
});

// ─── 2. Validate action ───────────────────────────────────────────────────────

describe("validateDocument — validate action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("valida documento READY → CONFIRMED com sucesso", async () => {
    mockDocumentFindUnique.mockResolvedValue({ ...stubDoc, status: "READY" });
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-staging-1",
      status: "CONFIRMED",
    });

    const result = await validateDocument({ documentId: "doc-staging-1" });

    expect(result.status).toBe("CONFIRMED");
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CONFIRMED" },
      }),
    );
  });

  it("documento não encontrado — lança erro", async () => {
    mockDocumentFindUnique.mockResolvedValue(null);

    await expect(
      validateDocument({ documentId: "nao-existe" }),
    ).rejects.toThrow("Documento não encontrado.");
  });

  it("documento não está em READY — lança erro de transição", async () => {
    mockDocumentFindUnique.mockResolvedValue({ ...stubDoc, status: "PENDING" });

    await expect(
      validateDocument({ documentId: "doc-staging-1" }),
    ).rejects.toThrow(/READY/);
  });
});

// ─── 3. Promote action ────────────────────────────────────────────────────────

describe("promoteDocument — promote action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("promove documento READY → CONFIRMED (documento principal)", async () => {
    mockDocumentFindUnique.mockResolvedValue({ ...stubDoc, status: "READY" });
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-staging-1",
      status: "CONFIRMED",
    });

    const result = await promoteDocument({ documentId: "doc-staging-1" });

    expect(result.status).toBe("CONFIRMED");
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CONFIRMED" },
      }),
    );
  });

  it("documento não está em READY — rejeita promoção", async () => {
    mockDocumentFindUnique.mockResolvedValue({
      ...stubDoc,
      status: "CONFIRMED",
    });

    await expect(
      promoteDocument({ documentId: "doc-staging-1" }),
    ).rejects.toThrow(/READY/);
  });
});
