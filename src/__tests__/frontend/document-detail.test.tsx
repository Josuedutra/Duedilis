/**
 * Document Detail Frontend Tests — Sprint D4, Task D4-E3-10v2
 * gov-1775322018351-sur0wt
 *
 * Tests for document detail page:
 *  1. Lifecycle badge — correct colour variant per CdeDocStatus
 *  2. Transition modal opens (action exposed: getTransitionModalData)
 *  3. Transition modal requires reason (transitionCdeDocLifecycle rejects empty reason)
 *  4. Revision timeline renders ordered DocumentRevision list
 *  5. Stamp timeline renders ValidationStamps with type and date
 *  6. Transition modal only shows valid transitions per status
 *
 * Note: vitest environment is "node" — tests exercise server actions and
 * pure mapping utilities that power the React components (TDD red phase for
 * getCdeStatusBadgeConfig, getDocumentDetailData, getValidationStamps).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockStatusTransitionLogCreate = vi.hoisted(() => vi.fn());
const mockDocumentRevisionFindMany = vi.hoisted(() => vi.fn());
const mockValidationStampFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: mockDocumentFindUnique,
      update: mockDocumentUpdate,
    },
    statusTransitionLog: {
      create: mockStatusTransitionLogCreate,
    },
    documentRevision: {
      findMany: mockDocumentRevisionFindMany,
    },
    validationStamp: {
      findMany: mockValidationStampFindMany,
    },
  },
}));

import { getCdeStatusBadgeConfig } from "@/lib/cde-status";
import {
  transitionCdeDocLifecycle,
  getDocumentDetailData,
  CDE_VALID_TRANSITIONS,
} from "@/lib/actions/cde-actions";
import { getRevisionHistory } from "@/lib/actions/cde-revisions";
import { getValidationStamps } from "@/lib/actions/cde-revisions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-test-001";
const PROJECT_ID = "proj-test-001";
const DOC_ID = "doc-detail-001";

function makeDoc(cdeStatus: string) {
  return {
    id: DOC_ID,
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    originalName: "A-STR-001-planta-piso1.pdf",
    cdeStatus,
    currentRevisionCode: "P01",
    createdAt: new Date("2026-03-01T10:00:00Z"),
    updatedAt: new Date("2026-03-15T14:00:00Z"),
  };
}

function makeRevision(
  id: string,
  revisionCode: string,
  createdAt: Date,
): object {
  return {
    id,
    documentId: DOC_ID,
    orgId: ORG_ID,
    revisionCode,
    fileChecksum:
      "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    storageKey: `/org/${ORG_ID}/${revisionCode}/file.pdf`,
    createdById: "user-1",
    createdAt,
  };
}

function makeStamp(id: string, stampType: string, createdAt: Date): object {
  return {
    id,
    documentId: DOC_ID,
    revisionId: "rev-001",
    orgId: ORG_ID,
    stampType,
    payloadHash:
      "deadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000000",
    stampedById: "user-1",
    createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lifecycle badge — getCdeStatusBadgeConfig returns correct colour per status
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-10v2 — 1. getCdeStatusBadgeConfig: colour per CdeDocStatus", () => {
  it("WIP → variant blue", () => {
    const config = getCdeStatusBadgeConfig("WIP");
    expect(config.variant).toBe("blue");
  });

  it("SHARED → variant yellow", () => {
    const config = getCdeStatusBadgeConfig("SHARED");
    expect(config.variant).toBe("yellow");
  });

  it("PUBLISHED → variant green", () => {
    const config = getCdeStatusBadgeConfig("PUBLISHED");
    expect(config.variant).toBe("green");
  });

  it("SUPERSEDED → variant gray", () => {
    const config = getCdeStatusBadgeConfig("SUPERSEDED");
    expect(config.variant).toBe("gray");
  });

  it("ARCHIVED → variant gray", () => {
    const config = getCdeStatusBadgeConfig("ARCHIVED");
    expect(config.variant).toBe("gray");
  });

  it("cada status tem label legível", () => {
    const statuses = ["WIP", "SHARED", "PUBLISHED", "SUPERSEDED", "ARCHIVED"];
    for (const status of statuses) {
      const config = getCdeStatusBadgeConfig(status);
      expect(config.label).toBeTruthy();
      expect(typeof config.label).toBe("string");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getDocumentDetailData — page data for document detail
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-10v2 — 2. getDocumentDetailData: carrega detalhes do documento", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna documento com cdeStatus correcto", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(makeDoc("WIP"));

    const result = await getDocumentDetailData({ documentId: DOC_ID });

    expect(result.document.id).toBe(DOC_ID);
    expect(result.document.cdeStatus).toBe("WIP");
  });

  it("lança erro se documento não encontrado", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(null);

    await expect(
      getDocumentDetailData({ documentId: "non-existent" }),
    ).rejects.toThrow("Documento não encontrado.");
  });

  it("lança erro se não autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getDocumentDetailData({ documentId: DOC_ID })).rejects.toThrow(
      "Não autenticado.",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Transition modal — reason é obrigatório
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-10v2 — 3. transitionCdeDocLifecycle: reason obrigatório", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita transição sem reason (string vazia)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(
      transitionCdeDocLifecycle({
        documentId: DOC_ID,
        toStatus: "SHARED",
        reason: "",
      }),
    ).rejects.toThrow("reason obrigatório");
  });

  it("rejeita transição com reason apenas de espaços", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(
      transitionCdeDocLifecycle({
        documentId: DOC_ID,
        toStatus: "SHARED",
        reason: "   ",
      }),
    ).rejects.toThrow("reason obrigatório");
  });

  it("aceita transição com reason válido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(makeDoc("WIP"));
    mockDocumentUpdate.mockResolvedValue({
      id: DOC_ID,
      cdeStatus: "SHARED",
    });
    mockStatusTransitionLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await transitionCdeDocLifecycle({
      documentId: DOC_ID,
      toStatus: "SHARED",
      reason: "Pronto para revisão pela equipa de coordenação.",
    });

    expect(result.cdeStatus).toBe("SHARED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Revision timeline — lista ordenada de DocumentRevision
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-10v2 — 4. getRevisionHistory: revision timeline ordenada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna lista vazia quando não há revisões", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentRevisionFindMany.mockResolvedValue([]);

    const result = await getRevisionHistory({ documentId: DOC_ID });

    expect(result).toEqual([]);
  });

  it("retorna revisões ordenadas por createdAt ascendente", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const rev1 = makeRevision(
      "rev-001",
      "P01",
      new Date("2026-03-01T10:00:00Z"),
    );
    const rev2 = makeRevision(
      "rev-002",
      "P02",
      new Date("2026-03-10T10:00:00Z"),
    );
    const rev3 = makeRevision(
      "rev-003",
      "A01",
      new Date("2026-03-20T10:00:00Z"),
    );
    mockDocumentRevisionFindMany.mockResolvedValue([rev1, rev2, rev3]);

    const result = await getRevisionHistory({ documentId: DOC_ID });

    expect(result).toHaveLength(3);
    expect(result[0].revisionCode).toBe("P01");
    expect(result[1].revisionCode).toBe("P02");
    expect(result[2].revisionCode).toBe("A01");
  });

  it("cada revisão contém revisionCode e fileChecksum", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const rev = makeRevision("rev-001", "P01", new Date());
    mockDocumentRevisionFindMany.mockResolvedValue([rev]);

    const result = await getRevisionHistory({ documentId: DOC_ID });

    expect(result[0].revisionCode).toBe("P01");
    expect(result[0].fileChecksum).toHaveLength(64); // SHA-256 hex
  });

  it("lança erro se não autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getRevisionHistory({ documentId: DOC_ID })).rejects.toThrow(
      "Não autenticado.",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Stamp timeline — ValidationStamps com tipo e data
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-10v2 — 5. getValidationStamps: stamp timeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna lista de stamps com stampType e createdAt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const stamp1 = makeStamp(
      "stamp-001",
      "APPROVAL",
      new Date("2026-03-15T12:00:00Z"),
    );
    const stamp2 = makeStamp(
      "stamp-002",
      "REVIEW",
      new Date("2026-03-20T09:00:00Z"),
    );
    mockValidationStampFindMany.mockResolvedValue([stamp1, stamp2]);

    const result = await getValidationStamps({ documentId: DOC_ID });

    expect(result).toHaveLength(2);
    expect(result[0].stampType).toBe("APPROVAL");
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[1].stampType).toBe("REVIEW");
  });

  it("retorna lista vazia quando não há stamps", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockValidationStampFindMany.mockResolvedValue([]);

    const result = await getValidationStamps({ documentId: DOC_ID });

    expect(result).toEqual([]);
  });

  it("cada stamp contém payloadHash imutável (64 chars hex)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const stamp = makeStamp(
      "stamp-001",
      "APPROVAL",
      new Date("2026-03-15T12:00:00Z"),
    );
    mockValidationStampFindMany.mockResolvedValue([stamp]);

    const result = await getValidationStamps({ documentId: DOC_ID });

    expect(result[0].payloadHash).toHaveLength(64);
  });

  it("lança erro se não autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getValidationStamps({ documentId: DOC_ID })).rejects.toThrow(
      "Não autenticado.",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Transition modal — só mostra transições válidas por status
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-10v2 — 6. CDE_VALID_TRANSITIONS: transições válidas por status", () => {
  it("WIP só pode ir para SHARED", () => {
    expect(CDE_VALID_TRANSITIONS["WIP"]).toEqual(["SHARED"]);
  });

  it("SHARED pode ir para PUBLISHED ou WIP (aprovação ou rejeição)", () => {
    expect(CDE_VALID_TRANSITIONS["SHARED"]).toContain("PUBLISHED");
    expect(CDE_VALID_TRANSITIONS["SHARED"]).toContain("WIP");
  });

  it("PUBLISHED só pode ir para SUPERSEDED", () => {
    expect(CDE_VALID_TRANSITIONS["PUBLISHED"]).toEqual(["SUPERSEDED"]);
  });

  it("SUPERSEDED só pode ir para ARCHIVED", () => {
    expect(CDE_VALID_TRANSITIONS["SUPERSEDED"]).toEqual(["ARCHIVED"]);
  });

  it("ARCHIVED não tem transições válidas (estado terminal)", () => {
    expect(CDE_VALID_TRANSITIONS["ARCHIVED"]).toEqual([]);
  });

  it("transição inválida WIP → PUBLISHED é rejeitada", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(makeDoc("WIP"));

    await expect(
      transitionCdeDocLifecycle({
        documentId: DOC_ID,
        toStatus: "PUBLISHED",
        reason: "Tentar skip de etapas.",
      }),
    ).rejects.toThrow("transição inválida");
  });

  it("transição inválida PUBLISHED → WIP é rejeitada (sem retrocesso)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(makeDoc("PUBLISHED"));

    await expect(
      transitionCdeDocLifecycle({
        documentId: DOC_ID,
        toStatus: "WIP",
        reason: "Tentar retroceder o lifecycle.",
      }),
    ).rejects.toThrow("transição inválida");
  });
});
