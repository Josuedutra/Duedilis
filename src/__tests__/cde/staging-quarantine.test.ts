/**
 * Staging Area Quarantine — TDD red phase
 * Task: gov-1775321986183-21c8k1 (D4-E3-06v2)
 *
 * Tests staging quarantine lifecycle: PENDING→VALIDATING→READY→PROMOTED.
 *
 * Scenarios (6 mandatory):
 *  1. createStagingDocument() cria doc com status PENDING
 *  2. validateStaging() move PENDING→VALIDATING (auto-checks: virus scan placeholder, format validation)
 *  3. promoteStaging() move READY→PROMOTED e cria Document real no CDE
 *  4. rejectStaging() move para REJECTED com reason obrigatório
 *  5. Transição inválida PENDING→PROMOTED (must validate first) — deve rejeitar
 *  6. Auto-suggest discipline/docType baseado no filename
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockStagingCreate = vi.hoisted(() => vi.fn());
const mockStagingFindUnique = vi.hoisted(() => vi.fn());
const mockStagingUpdate = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stagingDocument: {
      create: mockStagingCreate,
      findUnique: mockStagingFindUnique,
      update: mockStagingUpdate,
    },
    document: {
      create: mockDocumentCreate,
    },
  },
}));

// Import functions under test (do not exist yet — TDD red phase)
import {
  createStagingDocument,
  validateStaging,
  promoteStaging,
  rejectStaging,
} from "@/lib/actions/staging-quarantine";
import { suggestMetadataFromFilename } from "@/lib/status-badges";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-staging-001";
const PROJECT_ID = "proj-staging-001";
const FOLDER_ID = "folder-staging-001";
const UPLOADER_ID = "user-staging-001";
const STAGING_ID = "staging-doc-001";

const baseStagingDoc = {
  id: STAGING_ID,
  originalName: "EST-PLT-001-R0.pdf",
  isoName: null,
  status: "PENDING",
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  folderId: FOLDER_ID,
  uploadedById: UPLOADER_ID,
  uploadedAt: new Date("2026-04-04T12:00:00Z"),
  rejectionReason: null,
};

// ─── 1. createStagingDocument() — status PENDING ─────────────────────────────

describe("createStagingDocument — creates doc with PENDING status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a staging document with status PENDING", async () => {
    mockStagingCreate.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "PENDING",
    });

    const result = await createStagingDocument({
      originalName: "EST-PLT-001-R0.pdf",
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      folderId: FOLDER_ID,
      uploadedById: UPLOADER_ID,
    });

    expect(result.status).toBe("PENDING");
    expect(mockStagingCreate).toHaveBeenCalledOnce();
    expect(mockStagingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          originalName: "EST-PLT-001-R0.pdf",
          orgId: ORG_ID,
          projectId: PROJECT_ID,
          folderId: FOLDER_ID,
          uploadedById: UPLOADER_ID,
        }),
      }),
    );
  });
});

// ─── 2. validateStaging() — PENDING→VALIDATING ───────────────────────────────

describe("validateStaging — moves PENDING to VALIDATING", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions PENDING document to VALIDATING and returns auto-check results", async () => {
    mockStagingFindUnique.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "PENDING",
    });
    mockStagingUpdate.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "VALIDATING",
    });

    const result = await validateStaging({ stagingId: STAGING_ID });

    expect(result.status).toBe("VALIDATING");
    expect(result.checks).toBeDefined();
    expect(result.checks.virusScan).toBe("PASS"); // placeholder
    expect(result.checks.formatValidation).toBe("PASS");
    expect(mockStagingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STAGING_ID },
        data: expect.objectContaining({ status: "VALIDATING" }),
      }),
    );
  });

  it("throws if document is not in PENDING status", async () => {
    mockStagingFindUnique.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "VALIDATING",
    });

    await expect(validateStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /PENDING/,
    );
  });

  it("throws if staging document not found", async () => {
    mockStagingFindUnique.mockResolvedValueOnce(null);

    await expect(validateStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /não encontrado/i,
    );
  });
});

// ─── 3. promoteStaging() — READY→PROMOTED + creates CDE Document ─────────────

describe("promoteStaging — moves READY to PROMOTED and creates CDE Document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes a READY document and creates real Document in CDE", async () => {
    const readyDoc = { ...baseStagingDoc, status: "READY" };
    mockStagingFindUnique.mockResolvedValueOnce(readyDoc);
    mockStagingUpdate.mockResolvedValueOnce({
      ...readyDoc,
      status: "PROMOTED",
    });
    mockDocumentCreate.mockResolvedValueOnce({
      id: "cde-doc-001",
      originalName: readyDoc.originalName,
      status: "CONFIRMED",
    });

    const result = await promoteStaging({ stagingId: STAGING_ID });

    expect(result.stagingStatus).toBe("PROMOTED");
    expect(result.cdeDocumentId).toBeDefined();
    expect(mockDocumentCreate).toHaveBeenCalledOnce();
    expect(mockStagingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STAGING_ID },
        data: expect.objectContaining({ status: "PROMOTED" }),
      }),
    );
  });

  it("throws if document is not in READY status", async () => {
    mockStagingFindUnique.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "VALIDATING",
    });

    await expect(promoteStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /READY/,
    );
  });
});

// ─── 4. rejectStaging() — REJECTED com reason obrigatório ────────────────────

describe("rejectStaging — moves to REJECTED with mandatory reason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a READY document with a reason", async () => {
    const readyDoc = { ...baseStagingDoc, status: "READY" };
    mockStagingFindUnique.mockResolvedValueOnce(readyDoc);
    mockStagingUpdate.mockResolvedValueOnce({
      ...readyDoc,
      status: "REJECTED",
      rejectionReason: "Formato incorrecto.",
    });

    const result = await rejectStaging({
      stagingId: STAGING_ID,
      reason: "Formato incorrecto.",
    });

    expect(result.status).toBe("REJECTED");
    expect(mockStagingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "Formato incorrecto.",
        }),
      }),
    );
  });

  it("rejects a VALIDATING document with a reason", async () => {
    const validatingDoc = { ...baseStagingDoc, status: "VALIDATING" };
    mockStagingFindUnique.mockResolvedValueOnce(validatingDoc);
    mockStagingUpdate.mockResolvedValueOnce({
      ...validatingDoc,
      status: "REJECTED",
      rejectionReason: "Virus detectado.",
    });

    const result = await rejectStaging({
      stagingId: STAGING_ID,
      reason: "Virus detectado.",
    });

    expect(result.status).toBe("REJECTED");
  });

  it("throws if reason is empty", async () => {
    await expect(
      rejectStaging({ stagingId: STAGING_ID, reason: "" }),
    ).rejects.toThrow(/obrigatório/i);
  });

  it("throws if reason is only whitespace", async () => {
    await expect(
      rejectStaging({ stagingId: STAGING_ID, reason: "   " }),
    ).rejects.toThrow(/obrigatório/i);
  });
});

// ─── 5. Transição inválida PENDING→PROMOTED ───────────────────────────────────

describe("promoteStaging — invalid transition PENDING→PROMOTED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects promotion of a PENDING document (must validate first)", async () => {
    mockStagingFindUnique.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "PENDING",
    });

    await expect(promoteStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /READY/,
    );
    expect(mockDocumentCreate).not.toHaveBeenCalled();
    expect(mockStagingUpdate).not.toHaveBeenCalled();
  });

  it("rejects promotion of a REJECTED document", async () => {
    mockStagingFindUnique.mockResolvedValueOnce({
      ...baseStagingDoc,
      status: "REJECTED",
    });

    await expect(promoteStaging({ stagingId: STAGING_ID })).rejects.toThrow(
      /READY/,
    );
  });
});

// ─── 6. suggestMetadataFromFilename — auto-suggest discipline/docType ─────────

describe("suggestMetadataFromFilename — infers discipline and docType from filename", () => {
  it("infers discipline=ESTRUTURAL and docType=PLANTA from EST-PLT-001.pdf", () => {
    const result = suggestMetadataFromFilename("EST-PLT-001.pdf");
    expect(result.discipline).toBe("ESTRUTURAL");
    expect(result.docType).toBe("PLANTA");
  });

  it("infers discipline=ARQUITECTURA and docType=CORTE from ARQ-CRT-002-R1.pdf", () => {
    const result = suggestMetadataFromFilename("ARQ-CRT-002-R1.pdf");
    expect(result.discipline).toBe("ARQUITECTURA");
    expect(result.docType).toBe("CORTE");
  });

  it("infers discipline=MEP and docType=ESQUEMA from MEP-ESQ-010.pdf", () => {
    const result = suggestMetadataFromFilename("MEP-ESQ-010.pdf");
    expect(result.discipline).toBe("MEP");
    expect(result.docType).toBe("ESQUEMA");
  });

  it("returns null for both fields when filename does not match known pattern", () => {
    const result = suggestMetadataFromFilename("random-file.pdf");
    expect(result.discipline).toBeNull();
    expect(result.docType).toBeNull();
  });

  it("is case-insensitive for filename parsing", () => {
    const result = suggestMetadataFromFilename("est-plt-003.pdf");
    expect(result.discipline).toBe("ESTRUTURAL");
    expect(result.docType).toBe("PLANTA");
  });
});
