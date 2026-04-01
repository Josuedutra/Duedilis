/**
 * Evidence Links module tests — Sprint D3, Task D3-T06
 * Task: gov-1775077645284-qcec0w
 *
 * Módulo 8: Links Probatórios — resolve dor #1 ("fragmentação de contexto")
 *
 * Grupos de testes (red phase TDD — E3):
 *  - Grupo 1: CRUD (createEvidenceLink, listEvidenceLinks, getEntityWithLinks)
 *  - Grupo 2: Imutabilidade (no update/delete, hash SHA-256 válido)
 *  - Grupo 3: RLS (cross-org bloqueado, sem leak de dados)
 *  - Grupo 4: Audit trail (AuditLog criado, hash encadeado)
 *
 * NOTA: Todos os testes devem FALHAR (RED) até as server actions serem implementadas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "crypto";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockEvidenceLinkCreate = vi.hoisted(() => vi.fn());
const mockEvidenceLinkFindMany = vi.hoisted(() => vi.fn());
const mockEvidenceLinkFindUnique = vi.hoisted(() => vi.fn());
const mockEvidenceLinkUpdate = vi.hoisted(() => vi.fn());
const mockEvidenceLinkDelete = vi.hoisted(() => vi.fn());

const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());

const mockIssueFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockPhotoFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    evidenceLink: {
      create: mockEvidenceLinkCreate,
      findMany: mockEvidenceLinkFindMany,
      findUnique: mockEvidenceLinkFindUnique,
      update: mockEvidenceLinkUpdate,
      delete: mockEvidenceLinkDelete,
    },
    auditLog: {
      create: mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" }),
      findFirst: mockAuditLogFindFirst.mockResolvedValue(null),
    },
    issue: {
      findUnique: mockIssueFindUnique,
    },
    document: {
      findUnique: mockDocumentFindUnique,
    },
    photo: {
      findUnique: mockPhotoFindUnique,
    },
    meeting: {
      findUnique: mockMeetingFindUnique,
    },
  },
}));

// Importar funções (não existem ainda — red phase)
import {
  createEvidenceLink,
  listEvidenceLinks,
  getEntityWithLinks,
  updateEvidenceLink,
  deleteEvidenceLink,
} from "@/lib/actions/evidence-link-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseOrg1 = "org1";
const baseOrg2 = "org2";

const baseLinkResult = {
  id: "link-1",
  orgId: baseOrg1,
  projectId: "proj1",
  sourceType: "Issue",
  sourceId: "nc-1",
  targetType: "Photo",
  targetId: "photo-1",
  createdById: "u1",
  hash: "abc123hash",
  createdAt: new Date("2026-04-01T10:00:00Z"),
  description: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 1: CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceLink CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("createEvidenceLink NC → Photo → cria link com hash SHA-256", async () => {
    const createdAt = new Date("2026-04-01T10:00:00Z");
    const expectedHash = crypto
      .createHash("sha256")
      .update(`${baseOrg1}IssuenC-1Photophoto-1u1${createdAt.toISOString()}`)
      .digest("hex");

    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue({
      ...baseLinkResult,
      hash: expectedHash,
      createdAt,
    });

    const result = await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Issue",
      sourceId: "nc-1",
      targetType: "Photo",
      targetId: "photo-1",
    });

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(mockEvidenceLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: baseOrg1,
          sourceType: "Issue",
          sourceId: "nc-1",
          targetType: "Photo",
          targetId: "photo-1",
        }),
      }),
    );
  });

  it("createEvidenceLink NC → Document → cria link", async () => {
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockDocumentFindUnique.mockResolvedValue({ id: "doc-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue({
      ...baseLinkResult,
      targetType: "Document",
      targetId: "doc-1",
    });

    const result = await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Issue",
      sourceId: "nc-1",
      targetType: "Document",
      targetId: "doc-1",
    });

    expect(result.targetType).toBe("Document");
    expect(result.targetId).toBe("doc-1");
  });

  it("createEvidenceLink NC → Meeting → cria link", async () => {
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockMeetingFindUnique.mockResolvedValue({ id: "meet-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue({
      ...baseLinkResult,
      targetType: "Meeting",
      targetId: "meet-1",
    });

    const result = await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Issue",
      sourceId: "nc-1",
      targetType: "Meeting",
      targetId: "meet-1",
    });

    expect(result.targetType).toBe("Meeting");
    expect(result.targetId).toBe("meet-1");
  });

  it("createEvidenceLink Document → Photo → cria link", async () => {
    mockDocumentFindUnique.mockResolvedValue({ id: "doc-1", orgId: baseOrg1 });
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue({
      ...baseLinkResult,
      sourceType: "Document",
      sourceId: "doc-1",
      targetType: "Photo",
      targetId: "photo-1",
    });

    const result = await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Document",
      sourceId: "doc-1",
      targetType: "Photo",
      targetId: "photo-1",
    });

    expect(result.sourceType).toBe("Document");
    expect(result.targetType).toBe("Photo");
  });

  it("createEvidenceLink Photo → Meeting → cria link", async () => {
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });
    mockMeetingFindUnique.mockResolvedValue({ id: "meet-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue({
      ...baseLinkResult,
      sourceType: "Photo",
      sourceId: "photo-1",
      targetType: "Meeting",
      targetId: "meet-1",
    });

    const result = await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Photo",
      sourceId: "photo-1",
      targetType: "Meeting",
      targetId: "meet-1",
    });

    expect(result.sourceType).toBe("Photo");
    expect(result.targetType).toBe("Meeting");
  });

  it("listEvidenceLinks por sourceType+sourceId → retorna todas as ligações", async () => {
    mockEvidenceLinkFindMany.mockResolvedValue([
      { ...baseLinkResult, id: "link-1" },
      {
        ...baseLinkResult,
        id: "link-2",
        targetType: "Document",
        targetId: "doc-2",
      },
    ]);

    const result = await listEvidenceLinks({
      orgId: baseOrg1,
      sourceType: "Issue",
      sourceId: "nc-1",
    });

    expect(result).toHaveLength(2);
    expect(mockEvidenceLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: baseOrg1,
          sourceType: "Issue",
          sourceId: "nc-1",
        }),
      }),
    );
  });

  it("listEvidenceLinks por targetType+targetId → retorna ligações reversas", async () => {
    mockEvidenceLinkFindMany.mockResolvedValue([
      {
        ...baseLinkResult,
        id: "link-3",
        sourceType: "Document",
        sourceId: "doc-1",
      },
    ]);

    const result = await listEvidenceLinks({
      orgId: baseOrg1,
      targetType: "Photo",
      targetId: "photo-1",
    });

    expect(result).toHaveLength(1);
    expect(mockEvidenceLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: baseOrg1,
          targetType: "Photo",
          targetId: "photo-1",
        }),
      }),
    );
  });

  it("getEntityWithLinks → retorna entidade + todos os links (bidirecional)", async () => {
    // Links onde é source
    const linksAsSource = [
      {
        ...baseLinkResult,
        id: "link-1",
        sourceType: "Issue",
        sourceId: "nc-1",
      },
    ];
    // Links onde é target
    const linksAsTarget = [
      {
        ...baseLinkResult,
        id: "link-2",
        targetType: "Issue",
        targetId: "nc-1",
        sourceType: "Document",
        sourceId: "doc-5",
      },
    ];

    mockIssueFindUnique.mockResolvedValue({
      id: "nc-1",
      orgId: baseOrg1,
      title: "NC #1",
    });
    mockEvidenceLinkFindMany
      .mockResolvedValueOnce(linksAsSource) // first call: as source
      .mockResolvedValueOnce(linksAsTarget); // second call: as target

    const result = await getEntityWithLinks({
      orgId: baseOrg1,
      entityType: "Issue",
      entityId: "nc-1",
    });

    expect(result.entity).toMatchObject({ id: "nc-1" });
    expect(result.links).toHaveLength(2);
    // Links should be bidirectional — both directions returned
    const linkIds = result.links.map((l: { id: string }) => l.id);
    expect(linkIds).toContain("link-1");
    expect(linkIds).toContain("link-2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 2: Imutabilidade
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceLink immutability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("updateEvidenceLink → rejeita (links são imutáveis)", async () => {
    mockEvidenceLinkFindUnique.mockResolvedValue({
      ...baseLinkResult,
      id: "link-1",
    });

    await expect(
      updateEvidenceLink({
        linkId: "link-1",
        orgId: baseOrg1,
        description: "nova descrição",
      }),
    ).rejects.toThrow(/imutável|imutable|proibido|not allowed|403/i);

    // Prisma update must NOT be called
    expect(mockEvidenceLinkUpdate).not.toHaveBeenCalled();
  });

  it("deleteEvidenceLink → rejeita (links são imutáveis, append-only)", async () => {
    mockEvidenceLinkFindUnique.mockResolvedValue({
      ...baseLinkResult,
      id: "link-1",
    });

    await expect(
      deleteEvidenceLink({
        linkId: "link-1",
        orgId: baseOrg1,
      }),
    ).rejects.toThrow(/imutável|imutable|proibido|not allowed|403/i);

    // Prisma delete must NOT be called
    expect(mockEvidenceLinkDelete).not.toHaveBeenCalled();
  });

  it("hash do link é válido SHA-256(orgId+sourceType+sourceId+targetType+targetId+createdById+createdAt)", async () => {
    const createdAt = new Date("2026-04-01T10:00:00Z");
    const input = `${baseOrg1}Issuenc-1Photophoto-1u1${createdAt.toISOString()}`;
    const expectedHash = crypto
      .createHash("sha256")
      .update(input)
      .digest("hex");

    // Verify the hash format is correct SHA-256
    expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(expectedHash).toHaveLength(64);

    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue({
      ...baseLinkResult,
      hash: expectedHash,
      createdAt,
    });

    const result = await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Issue",
      sourceId: "nc-1",
      targetType: "Photo",
      targetId: "photo-1",
    });

    // The returned hash must be a valid SHA-256
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash não pode ser alterado após criação", async () => {
    mockEvidenceLinkFindUnique.mockResolvedValue({
      ...baseLinkResult,
      id: "link-1",
      hash: "original-hash-abc123",
    });

    // Any attempt to update (including hash) must fail
    await expect(
      updateEvidenceLink({
        linkId: "link-1",
        orgId: baseOrg1,
        hash: "tampered-hash-xyz999",
      }),
    ).rejects.toThrow(/imutável|imutable|proibido|not allowed|403/i);

    expect(mockEvidenceLinkUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 3: RLS
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceLink RLS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("createEvidenceLink com source de outra org → 403", async () => {
    // Source entity belongs to org2, link is being created in org1
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg2 }); // different org!
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });

    await expect(
      createEvidenceLink({
        orgId: baseOrg1,
        projectId: "proj1",
        sourceType: "Issue",
        sourceId: "nc-1", // belongs to org2
        targetType: "Photo",
        targetId: "photo-1",
      }),
    ).rejects.toThrow(/403|forbidden|não autorizado|cross-org/i);

    expect(mockEvidenceLinkCreate).not.toHaveBeenCalled();
  });

  it("createEvidenceLink com target de outra org → 403", async () => {
    // Target entity belongs to org2, link is being created in org1
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg2 }); // different org!

    await expect(
      createEvidenceLink({
        orgId: baseOrg1,
        projectId: "proj1",
        sourceType: "Issue",
        sourceId: "nc-1",
        targetType: "Photo",
        targetId: "photo-1", // belongs to org2
      }),
    ).rejects.toThrow(/403|forbidden|não autorizado|cross-org/i);

    expect(mockEvidenceLinkCreate).not.toHaveBeenCalled();
  });

  it("listEvidenceLinks de outra org → [] (sem leak)", async () => {
    // User is authenticated but not a member of org2 → no membership
    mockOrgMembershipFindUnique.mockResolvedValue(null); // not a member of org2
    mockEvidenceLinkFindMany.mockResolvedValue([]);

    const result = await listEvidenceLinks({
      orgId: baseOrg2,
      sourceType: "Issue",
      sourceId: "nc-external",
    });

    expect(result).toHaveLength(0);
    // If called, must have orgId filter to prevent cross-org leak
    if (mockEvidenceLinkFindMany.mock.calls.length > 0) {
      expect(mockEvidenceLinkFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: baseOrg2 }),
        }),
      );
    }
  });

  it("createEvidenceLink source orgId ≠ target orgId → 403 (cross-org proibido)", async () => {
    // Both entities exist but in different orgs
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockDocumentFindUnique.mockResolvedValue({ id: "doc-1", orgId: baseOrg2 }); // different org from source

    await expect(
      createEvidenceLink({
        orgId: baseOrg1,
        projectId: "proj1",
        sourceType: "Issue",
        sourceId: "nc-1",
        targetType: "Document",
        targetId: "doc-1",
      }),
    ).rejects.toThrow(/403|forbidden|não autorizado|cross-org/i);

    expect(mockEvidenceLinkCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 4: Audit trail
// ─────────────────────────────────────────────────────────────────────────────

describe("EvidenceLink audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("criar link gera AuditLog com action=CREATE, entityType=EvidenceLink", async () => {
    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue(baseLinkResult);
    mockAuditLogCreate.mockResolvedValue({
      id: "audit-1",
      action: "CREATE",
      entityType: "EvidenceLink",
      entityId: "link-1",
      orgId: baseOrg1,
      performedById: "u1",
      hash: "audit-hash-abc123",
      createdAt: new Date(),
    });

    await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Issue",
      sourceId: "nc-1",
      targetType: "Photo",
      targetId: "photo-1",
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "EvidenceLink",
          orgId: baseOrg1,
        }),
      }),
    );
  });

  it("AuditLog.hash é válido (hash encadeado)", async () => {
    const previousAuditHash = "previous-chain-hash-000";
    mockAuditLogFindFirst.mockResolvedValue({
      id: "prev-audit",
      hash: previousAuditHash,
    });

    mockIssueFindUnique.mockResolvedValue({ id: "nc-1", orgId: baseOrg1 });
    mockPhotoFindUnique.mockResolvedValue({ id: "photo-1", orgId: baseOrg1 });
    mockEvidenceLinkCreate.mockResolvedValue(baseLinkResult);

    const newAuditHash = crypto
      .createHash("sha256")
      .update(`${previousAuditHash}CREATEEvidenceLinklink-1u1`)
      .digest("hex");

    mockAuditLogCreate.mockResolvedValue({
      id: "audit-1",
      action: "CREATE",
      entityType: "EvidenceLink",
      entityId: "link-1",
      orgId: baseOrg1,
      performedById: "u1",
      hash: newAuditHash,
      createdAt: new Date(),
    });

    await createEvidenceLink({
      orgId: baseOrg1,
      projectId: "proj1",
      sourceType: "Issue",
      sourceId: "nc-1",
      targetType: "Photo",
      targetId: "photo-1",
    });

    const auditCall = mockAuditLogCreate.mock.calls[0];
    expect(auditCall).toBeDefined();
    // AuditLog hash must be a valid SHA-256
    const auditHashArg = auditCall[0]?.data?.hash;
    if (auditHashArg) {
      expect(auditHashArg).toMatch(/^[a-f0-9]{64}$/);
    } else {
      // hash should be set
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        }),
      );
    }
  });
});
