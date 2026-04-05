/**
 * Staging Area Frontend Tests — Sprint D4, Task D4-E3-11v2
 * gov-1775322024369-k9kd4f
 *
 * Tests for the Staging Area frontend page:
 *  1. Lista renderiza StagingDocuments com status badge (PENDING/VALIDATING/READY/PROMOTED/REJECTED)
 *  2. Botão "Validate" visível para docs PENDING → chama validateStaging()
 *  3. Botão "Promote" visível para docs READY → chama promoteStaging()
 *  4. Botão "Reject" visível para docs PENDING/VALIDATING/READY → abre modal com campo reason
 *  5. Reject sem reason → erro de validação
 *  6. Metadata form mostra discipline/docType auto-sugeridos do filename
 *
 * Note: vitest environment is "node" — tests exercise server actions and
 * pure mapping utilities that power the React components (TDD for
 * getStagingStatusBadgeConfig, canValidateStaging, canPromoteStaging,
 * canRejectStaging, and CRUD server actions).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockStagingFindMany = vi.hoisted(() => vi.fn());
const mockStagingFindUnique = vi.hoisted(() => vi.fn());
const mockStagingUpdate = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stagingDocument: {
      findMany: mockStagingFindMany,
      findUnique: mockStagingFindUnique,
      update: mockStagingUpdate,
    },
    document: {
      create: mockDocumentCreate,
    },
  },
}));

import {
  validateStaging,
  promoteStaging,
  rejectStaging,
} from "@/lib/actions/staging-quarantine";
import {
  suggestMetadataFromFilename,
  getStagingStatusBadgeConfig,
  canValidateStaging,
  canPromoteStaging,
  canRejectStaging,
} from "@/lib/status-badges";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAGING_ID = "staging-ui-001";

const makeStaging = (status: string) => ({
  id: STAGING_ID,
  originalName: "ARQ-PLT-001-R0.pdf",
  isoName: null,
  status,
  orgId: "org-1",
  projectId: "proj-1",
  folderId: "folder-1",
  uploadedById: "user-1",
  uploadedAt: new Date("2026-04-04T10:00:00Z"),
  rejectionReason: null,
});

// ─── 1. Status badge — PENDING/VALIDATING/READY/PROMOTED/REJECTED ─────────────

describe("getStagingStatusBadgeConfig — status badge for all statuses", () => {
  it("PENDING → badge variant warning com label", () => {
    const config = getStagingStatusBadgeConfig("PENDING");
    expect(config.variant).toBe("warning");
    expect(config.label).toBeTruthy();
  });

  it("VALIDATING → badge variant default ou warning com label", () => {
    const config = getStagingStatusBadgeConfig("VALIDATING");
    expect(["default", "warning"]).toContain(config.variant);
    expect(config.label).toBeTruthy();
  });

  it("READY → badge variant success com label", () => {
    const config = getStagingStatusBadgeConfig("READY");
    expect(config.variant).toBe("success");
    expect(config.label).toBeTruthy();
  });

  it("PROMOTED → badge variant success com label", () => {
    const config = getStagingStatusBadgeConfig("PROMOTED");
    expect(config.variant).toBe("success");
    expect(config.label).toBeTruthy();
  });

  it("REJECTED → badge variant error com label", () => {
    const config = getStagingStatusBadgeConfig("REJECTED");
    expect(config.variant).toBe("error");
    expect(config.label).toBeTruthy();
  });

  it("status desconhecido → fallback sem crash", () => {
    const config = getStagingStatusBadgeConfig("UNKNOWN");
    expect(config).toBeDefined();
    expect(config.variant).toBeTruthy();
    expect(config.label).toBeTruthy();
  });
});

// ─── 2. Botão "Validate" — visível apenas para PENDING ───────────────────────

describe("canValidateStaging — botão Validate visível só para PENDING", () => {
  it("PENDING → pode validar", () => {
    expect(canValidateStaging("PENDING")).toBe(true);
  });

  it("VALIDATING → não pode validar", () => {
    expect(canValidateStaging("VALIDATING")).toBe(false);
  });

  it("READY → não pode validar", () => {
    expect(canValidateStaging("READY")).toBe(false);
  });

  it("PROMOTED → não pode validar", () => {
    expect(canValidateStaging("PROMOTED")).toBe(false);
  });

  it("REJECTED → não pode validar", () => {
    expect(canValidateStaging("REJECTED")).toBe(false);
  });
});

describe("validateStaging — chama server action para doc PENDING", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PENDING → transição para VALIDATING com sucesso", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("PENDING"));
    mockStagingUpdate.mockResolvedValueOnce({
      ...makeStaging("VALIDATING"),
    });

    const result = await validateStaging({ stagingId: STAGING_ID });

    expect(result.status).toBe("VALIDATING");
    expect(result.checks).toBeDefined();
    expect(mockStagingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "VALIDATING" }),
      }),
    );
  });

  it("doc não encontrado → lança erro", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(null);

    await expect(validateStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /não encontrado/i,
    );
  });

  it("doc não PENDING → lança erro de transição", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("READY"));

    await expect(validateStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /PENDING/,
    );
  });
});

// ─── 3. Botão "Promote" — visível apenas para READY ──────────────────────────

describe("canPromoteStaging — botão Promote visível só para READY", () => {
  it("READY → pode promover", () => {
    expect(canPromoteStaging("READY")).toBe(true);
  });

  it("PENDING → não pode promover", () => {
    expect(canPromoteStaging("PENDING")).toBe(false);
  });

  it("VALIDATING → não pode promover", () => {
    expect(canPromoteStaging("VALIDATING")).toBe(false);
  });

  it("PROMOTED → não pode promover", () => {
    expect(canPromoteStaging("PROMOTED")).toBe(false);
  });

  it("REJECTED → não pode promover", () => {
    expect(canPromoteStaging("REJECTED")).toBe(false);
  });
});

describe("promoteStaging — chama server action para doc READY", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("READY → promovido para PROMOTED, cria documento CDE", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("READY"));
    mockStagingUpdate.mockResolvedValueOnce(makeStaging("PROMOTED"));
    mockDocumentCreate.mockResolvedValueOnce({
      id: "cde-doc-001",
      originalName: "ARQ-PLT-001-R0.pdf",
      status: "CONFIRMED",
    });

    const result = await promoteStaging({ stagingId: STAGING_ID });

    expect(result.stagingStatus).toBe("PROMOTED");
    expect(result.cdeDocumentId).toBeDefined();
    expect(mockDocumentCreate).toHaveBeenCalledOnce();
  });

  it("doc não READY → rejeita promoção", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("PENDING"));

    await expect(promoteStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /READY/,
    );
    expect(mockDocumentCreate).not.toHaveBeenCalled();
  });
});

// ─── 4. Botão "Reject" — visível para PENDING/VALIDATING/READY ───────────────

describe("canRejectStaging — botão Reject visível para PENDING/VALIDATING/READY", () => {
  it("PENDING → pode rejeitar", () => {
    expect(canRejectStaging("PENDING")).toBe(true);
  });

  it("VALIDATING → pode rejeitar", () => {
    expect(canRejectStaging("VALIDATING")).toBe(true);
  });

  it("READY → pode rejeitar", () => {
    expect(canRejectStaging("READY")).toBe(true);
  });

  it("PROMOTED → não pode rejeitar", () => {
    expect(canRejectStaging("PROMOTED")).toBe(false);
  });

  it("REJECTED → não pode rejeitar", () => {
    expect(canRejectStaging("REJECTED")).toBe(false);
  });
});

describe("rejectStaging — modal com campo reason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PENDING → rejeitado com reason válida", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("PENDING"));
    mockStagingUpdate.mockResolvedValueOnce({
      ...makeStaging("REJECTED"),
      rejectionReason: "Nomenclatura inválida.",
    });

    const result = await rejectStaging({
      stagingId: STAGING_ID,
      reason: "Nomenclatura inválida.",
    });

    expect(result.status).toBe("REJECTED");
    expect(mockStagingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "Nomenclatura inválida.",
        }),
      }),
    );
  });

  it("VALIDATING → rejeitado com reason válida", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("VALIDATING"));
    mockStagingUpdate.mockResolvedValueOnce({
      ...makeStaging("REJECTED"),
      rejectionReason: "Virus detectado.",
    });

    const result = await rejectStaging({
      stagingId: STAGING_ID,
      reason: "Virus detectado.",
    });

    expect(result.status).toBe("REJECTED");
  });

  it("READY → rejeitado com reason válida", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(makeStaging("READY"));
    mockStagingUpdate.mockResolvedValueOnce({
      ...makeStaging("REJECTED"),
      rejectionReason: "Formato incorrecto.",
    });

    const result = await rejectStaging({
      stagingId: STAGING_ID,
      reason: "Formato incorrecto.",
    });

    expect(result.status).toBe("REJECTED");
  });
});

// ─── 5. Reject sem reason → erro de validação ────────────────────────────────

describe("rejectStaging — validação de reason obrigatória (modal)", () => {
  it("reason vazia → lança erro de validação", async () => {
    await expect(
      rejectStaging({ stagingId: STAGING_ID, reason: "" }),
    ).rejects.toThrow(/obrigatório/i);
  });

  it("reason só espaços → lança erro de validação", async () => {
    await expect(
      rejectStaging({ stagingId: STAGING_ID, reason: "   " }),
    ).rejects.toThrow(/obrigatório/i);
  });
});

// ─── 6. Metadata form — discipline/docType auto-sugeridos do filename ─────────

describe("suggestMetadataFromFilename — metadata form auto-suggest", () => {
  it("ARQ-PLT-001-R0.pdf → discipline=ARQUITECTURA, docType=PLANTA", () => {
    const result = suggestMetadataFromFilename("ARQ-PLT-001-R0.pdf");
    expect(result.discipline).toBe("ARQUITECTURA");
    expect(result.docType).toBe("PLANTA");
  });

  it("EST-PLT-001.pdf → discipline=ESTRUTURAL, docType=PLANTA", () => {
    const result = suggestMetadataFromFilename("EST-PLT-001.pdf");
    expect(result.discipline).toBe("ESTRUTURAL");
    expect(result.docType).toBe("PLANTA");
  });

  it("MEP-ESQ-010.pdf → discipline=MEP, docType=ESQUEMA", () => {
    const result = suggestMetadataFromFilename("MEP-ESQ-010.pdf");
    expect(result.discipline).toBe("MEP");
    expect(result.docType).toBe("ESQUEMA");
  });

  it("ARQ-CRT-002-R1.pdf → discipline=ARQUITECTURA, docType=CORTE", () => {
    const result = suggestMetadataFromFilename("ARQ-CRT-002-R1.pdf");
    expect(result.discipline).toBe("ARQUITECTURA");
    expect(result.docType).toBe("CORTE");
  });

  it("filename sem padrão → discipline=null, docType=null", () => {
    const result = suggestMetadataFromFilename("documento-sem-padrao.pdf");
    expect(result.discipline).toBeNull();
    expect(result.docType).toBeNull();
  });

  it("filename em minúsculas → parsing case-insensitive", () => {
    const result = suggestMetadataFromFilename("arq-plt-003.pdf");
    expect(result.discipline).toBe("ARQUITECTURA");
    expect(result.docType).toBe("PLANTA");
  });
});
