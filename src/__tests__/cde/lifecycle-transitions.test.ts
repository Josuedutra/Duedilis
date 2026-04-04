/**
 * CDE Document Lifecycle Transitions — TDD red phase
 * Task: gov-1775321957093-l8e8iy (D4-E3-02v2)
 *
 * Tests CDE document publication lifecycle:
 *   WIP → SHARED → PUBLISHED → SUPERSEDED → ARCHIVED
 *
 * Scenarios (6 mandatory):
 *  1. Valid WIP → SHARED with required reason
 *  2. Valid SHARED → PUBLISHED
 *  3. Invalid WIP → PUBLISHED (skip not allowed)
 *  4. Invalid PUBLISHED → WIP (backward not allowed)
 *  5. Transition without reason — reject with error
 *  6. StatusTransitionLog created after each valid transition (append-only audit trail)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockStatusTransitionLogCreate = vi.hoisted(() => vi.fn());

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
  },
}));

// Import function under test (does not exist yet — TDD red phase)
import { transitionCdeDocLifecycle } from "@/lib/actions/cde-actions";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function mockDoc(status: string) {
  return {
    id: "doc-1",
    cdeStatus: status,
    orgId: "org-1",
    projectId: "proj-1",
  };
}

function mockLogEntry(from: string, to: string) {
  return {
    id: "log-1",
    documentId: "doc-1",
    fromStatus: from,
    toStatus: to,
    reason: "test reason",
    createdAt: new Date(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("transitionCdeDocLifecycle — paths válidos", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 1: WIP → SHARED com reason obrigatório
  it("deve permitir transição válida WIP → SHARED com reason", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("WIP"));
    mockDocumentUpdate.mockResolvedValue({ id: "doc-1", cdeStatus: "SHARED" });
    mockStatusTransitionLogCreate.mockResolvedValue(
      mockLogEntry("WIP", "SHARED"),
    );

    const result = await transitionCdeDocLifecycle({
      documentId: "doc-1",
      toStatus: "SHARED",
      reason: "Enviado para revisão da equipa",
    });

    expect(result.cdeStatus).toBe("SHARED");
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({ cdeStatus: "SHARED" }),
      }),
    );
  });

  // Cenário 2: SHARED → PUBLISHED
  it("deve permitir transição válida SHARED → PUBLISHED", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("SHARED"));
    mockDocumentUpdate.mockResolvedValue({
      id: "doc-1",
      cdeStatus: "PUBLISHED",
    });
    mockStatusTransitionLogCreate.mockResolvedValue(
      mockLogEntry("SHARED", "PUBLISHED"),
    );

    const result = await transitionCdeDocLifecycle({
      documentId: "doc-1",
      toStatus: "PUBLISHED",
      reason: "Aprovado para publicação",
    });

    expect(result.cdeStatus).toBe("PUBLISHED");
  });
});

describe("transitionCdeDocLifecycle — paths inválidos", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 3: WIP → PUBLISHED (skip not allowed)
  it("deve rejeitar transição inválida WIP → PUBLISHED (skip de SHARED)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("WIP"));

    await expect(
      transitionCdeDocLifecycle({
        documentId: "doc-1",
        toStatus: "PUBLISHED",
        reason: "tentar saltar SHARED",
      }),
    ).rejects.toThrow(/inválida|WIP.*PUBLISHED|não permitida/i);

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  // Cenário 4: PUBLISHED → WIP (backward not allowed)
  it("deve rejeitar transição inválida PUBLISHED → WIP (retrocesso não permitido)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("PUBLISHED"));

    await expect(
      transitionCdeDocLifecycle({
        documentId: "doc-1",
        toStatus: "WIP",
        reason: "tentar reverter",
      }),
    ).rejects.toThrow(/inválida|PUBLISHED.*WIP|não permitida/i);

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });

  // Cenário 5: Transição sem reason — deve rejeitar
  it("deve rejeitar transição sem reason obrigatório", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("WIP"));

    await expect(
      transitionCdeDocLifecycle({
        documentId: "doc-1",
        toStatus: "SHARED",
        reason: "",
      }),
    ).rejects.toThrow(/reason|motivo|obrigatório/i);

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });
});

describe("transitionCdeDocLifecycle — StatusTransitionLog audit trail", () => {
  beforeEach(() => vi.clearAllMocks());

  // Cenário 6: StatusTransitionLog criado após cada transição válida
  it("deve criar StatusTransitionLog após transição válida (append-only audit trail)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("WIP"));
    mockDocumentUpdate.mockResolvedValue({ id: "doc-1", cdeStatus: "SHARED" });
    mockStatusTransitionLogCreate.mockResolvedValue(
      mockLogEntry("WIP", "SHARED"),
    );

    await transitionCdeDocLifecycle({
      documentId: "doc-1",
      toStatus: "SHARED",
      reason: "Revisão iniciada",
    });

    expect(mockStatusTransitionLogCreate).toHaveBeenCalledOnce();
    expect(mockStatusTransitionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "doc-1",
          fromStatus: "WIP",
          toStatus: "SHARED",
          reason: "Revisão iniciada",
        }),
      }),
    );
  });

  it("não deve criar StatusTransitionLog em transição inválida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDocumentFindUnique.mockResolvedValue(mockDoc("WIP"));

    await expect(
      transitionCdeDocLifecycle({
        documentId: "doc-1",
        toStatus: "ARCHIVED",
        reason: "saltar tudo",
      }),
    ).rejects.toThrow();

    expect(mockStatusTransitionLogCreate).not.toHaveBeenCalled();
  });
});
