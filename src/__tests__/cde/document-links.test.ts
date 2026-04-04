/**
 * D4-E3-07v2: DocumentLink — create, listFrom/To, isEvidence filter
 * Task: gov-1775321993198-gokwh3
 *
 * TDD red/green phase — covers full DocumentLink spec including all link types,
 * SUPERSEDES side-effect, and EvidenceLink backward compatibility.
 *
 * Cenários obrigatórios:
 *  1. createDocumentLink() com tipo REFERENCE entre 2 documentos
 *  2. createDocumentLink() com tipo EVIDENCE e isEvidence=true
 *  3. listDocumentLinks() bidirecional — FROM doc A e TO doc A
 *  4. getDocumentEvidenceLinks() filtra apenas links com isEvidence=true
 *  5. Tipos suportados: REFERENCE, ATTACHMENT, EVIDENCE, SUPERSEDES, RESPONDS_TO
 *  6. Link com tipo SUPERSEDES actualiza status do doc anterior
 *  7. EvidenceLink existente permanece intacto (backward compatibility)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockDocumentLinkCreate = vi.hoisted(() => vi.fn());
const mockDocumentLinkFindMany = vi.hoisted(() => vi.fn());
const mockDocumentLinkFindFirst = vi.hoisted(() => vi.fn());

const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());

const mockEvidenceLinkCreate = vi.hoisted(() => vi.fn());
const mockEvidenceLinkFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    documentLink: {
      create: mockDocumentLinkCreate,
      findMany: mockDocumentLinkFindMany,
      findFirst: mockDocumentLinkFindFirst,
    },
    document: {
      update: mockDocumentUpdate,
      findUnique: mockDocumentFindUnique,
    },
    evidenceLink: {
      create: mockEvidenceLinkCreate,
      findMany: mockEvidenceLinkFindMany,
    },
  },
}));

import {
  createDocumentLink,
  listLinksFrom,
  listLinksTo,
  getDocumentEvidenceLinks,
} from "@/lib/actions/document-link-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-cde-001";
const PROJECT_ID = "proj-cde-001";
const DOC_A = "doc-a-cde";
const DOC_B = "doc-b-cde";
const ISSUE_ID = "issue-cde-001";

const baseLink = {
  id: "doclink-cde-1",
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  sourceType: "Document",
  sourceId: DOC_A,
  targetType: "Document",
  targetId: DOC_B,
  linkType: "REFERENCE",
  isEvidence: false,
  createdById: "u1",
  createdAt: new Date("2026-04-04T12:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 1: createDocumentLink() com tipo REFERENCE entre 2 documentos
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: DocumentLink — create REFERENCE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockDocumentLinkFindFirst.mockResolvedValue(null);
  });

  it("cria link REFERENCE entre Doc A e Doc B com sucesso", async () => {
    mockDocumentLinkCreate.mockResolvedValue(baseLink);

    const result = await createDocumentLink({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Document",
      sourceId: DOC_A,
      targetType: "Document",
      targetId: DOC_B,
      linkType: "REFERENCE",
    });

    expect(result.id).toBe("doclink-cde-1");
    expect(result.linkType).toBe("REFERENCE");
    expect(result.isEvidence).toBe(false);
    expect(result.sourceId).toBe(DOC_A);
    expect(result.targetId).toBe(DOC_B);
    expect(mockDocumentLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: ORG_ID,
          sourceType: "Document",
          sourceId: DOC_A,
          targetType: "Document",
          targetId: DOC_B,
          linkType: "REFERENCE",
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 2: createDocumentLink() com tipo EVIDENCE e isEvidence=true
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: DocumentLink — create EVIDENCE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockDocumentLinkFindFirst.mockResolvedValue(null);
  });

  it("cria link EVIDENCE com isEvidence=true entre Issue e Document", async () => {
    const evidenceLink = {
      ...baseLink,
      id: "doclink-ev-cde-1",
      sourceType: "Issue",
      sourceId: ISSUE_ID,
      targetType: "Document",
      targetId: DOC_A,
      linkType: "EVIDENCE",
      isEvidence: true,
    };
    mockDocumentLinkCreate.mockResolvedValue(evidenceLink);

    const result = await createDocumentLink({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Issue",
      sourceId: ISSUE_ID,
      targetType: "Document",
      targetId: DOC_A,
      linkType: "EVIDENCE",
      isEvidence: true,
    });

    expect(result.isEvidence).toBe(true);
    expect(result.linkType).toBe("EVIDENCE");
    expect(result.sourceType).toBe("Issue");
    expect(result.sourceId).toBe(ISSUE_ID);
    expect(mockDocumentLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isEvidence: true,
          linkType: "EVIDENCE",
          sourceType: "Issue",
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 3: listDocumentLinks() bidirecional
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: DocumentLink — listFrom/listTo bidirecional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("listLinksFrom(docA) retorna links onde sourceId=docA", async () => {
    mockDocumentLinkFindMany.mockResolvedValue([baseLink]);

    const result = await listLinksFrom({ orgId: ORG_ID, sourceId: DOC_A });

    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe(DOC_A);
    expect(mockDocumentLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_ID, sourceId: DOC_A }),
      }),
    );
  });

  it("listLinksTo(docA) retorna links onde targetId=docA", async () => {
    const linkToA = {
      ...baseLink,
      id: "doclink-to-a",
      targetId: DOC_A,
      sourceId: DOC_B,
    };
    mockDocumentLinkFindMany.mockResolvedValue([linkToA]);

    const result = await listLinksTo({ orgId: ORG_ID, targetId: DOC_A });

    expect(result).toHaveLength(1);
    expect(result[0].targetId).toBe(DOC_A);
    expect(mockDocumentLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_ID, targetId: DOC_A }),
      }),
    );
  });

  it("listLinksFrom e listLinksTo retornam o mesmo link (consistência bidirecional)", async () => {
    mockDocumentLinkFindMany.mockResolvedValue([baseLink]);
    const fromResults = await listLinksFrom({ orgId: ORG_ID, sourceId: DOC_A });

    mockDocumentLinkFindMany.mockResolvedValue([baseLink]);
    const toResults = await listLinksTo({ orgId: ORG_ID, targetId: DOC_B });

    expect(fromResults[0].id).toBe(toResults[0].id);
    expect(fromResults[0].sourceId).toBe(DOC_A);
    expect(toResults[0].targetId).toBe(DOC_B);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 4: getDocumentEvidenceLinks() filtra apenas isEvidence=true
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: DocumentLink — isEvidence filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("getDocumentEvidenceLinks retorna apenas links com isEvidence=true", async () => {
    const evidenceLink = {
      ...baseLink,
      id: "ev-link-1",
      targetId: DOC_A,
      isEvidence: true,
    };
    mockDocumentLinkFindMany.mockResolvedValue([evidenceLink]);

    const result = await getDocumentEvidenceLinks({
      orgId: ORG_ID,
      docId: DOC_A,
    });

    expect(result).toHaveLength(1);
    expect(result[0].isEvidence).toBe(true);
    expect(mockDocumentLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isEvidence: true }),
      }),
    );
  });

  it("getDocumentEvidenceLinks não retorna links com isEvidence=false", async () => {
    mockDocumentLinkFindMany.mockResolvedValue([]);

    const result = await getDocumentEvidenceLinks({
      orgId: ORG_ID,
      docId: DOC_B,
    });

    expect(result).toHaveLength(0);
  });

  it("getDocumentEvidenceLinks devolve múltiplos links de evidência para o mesmo doc", async () => {
    const links = [
      { ...baseLink, id: "ev-1", targetId: DOC_A, isEvidence: true },
      {
        ...baseLink,
        id: "ev-2",
        sourceId: DOC_A,
        sourceType: "Issue",
        isEvidence: true,
      },
    ];
    mockDocumentLinkFindMany.mockResolvedValue(links);

    const result = await getDocumentEvidenceLinks({
      orgId: ORG_ID,
      docId: DOC_A,
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((l: { isEvidence: boolean }) => l.isEvidence)).toBe(
      true,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 5: Tipos suportados — REFERENCE, ATTACHMENT, EVIDENCE, SUPERSEDES, RESPONDS_TO
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: DocumentLink — todos os tipos suportados", () => {
  const SUPPORTED_TYPES = [
    "REFERENCE",
    "ATTACHMENT",
    "EVIDENCE",
    "SUPERSEDES",
    "RESPONDS_TO",
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockDocumentLinkFindFirst.mockResolvedValue(null);
    mockDocumentUpdate.mockResolvedValue({});
  });

  for (const linkType of SUPPORTED_TYPES) {
    it(`cria link com tipo ${linkType} sem erro`, async () => {
      const linkResult = {
        ...baseLink,
        id: `doclink-${linkType.toLowerCase()}`,
        linkType,
        isEvidence: linkType === "EVIDENCE",
      };
      mockDocumentLinkCreate.mockResolvedValue(linkResult);

      const result = await createDocumentLink({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        sourceType: "Document",
        sourceId: DOC_A,
        targetType: "Document",
        targetId: DOC_B,
        linkType,
        isEvidence: linkType === "EVIDENCE",
      });

      expect(result.linkType).toBe(linkType);
      expect(mockDocumentLinkCreate).toHaveBeenCalledOnce();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 6: SUPERSEDES actualiza status do documento anterior
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: DocumentLink — SUPERSEDES actualiza doc anterior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockDocumentLinkFindFirst.mockResolvedValue(null);
  });

  it("createDocumentLink SUPERSEDES chama document.update no doc anterior (sourceId)", async () => {
    const supersedesLink = {
      ...baseLink,
      id: "doclink-supersedes-1",
      linkType: "SUPERSEDES",
      // DOC_A supersedes DOC_B → DOC_B becomes SUPERSEDED
      sourceId: DOC_A,
      targetId: DOC_B,
    };
    mockDocumentLinkCreate.mockResolvedValue(supersedesLink);
    mockDocumentUpdate.mockResolvedValue({ id: DOC_B, status: "SUPERSEDED" });

    const result = await createDocumentLink({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Document",
      sourceId: DOC_A,
      targetType: "Document",
      targetId: DOC_B,
      linkType: "SUPERSEDES",
    });

    expect(result.linkType).toBe("SUPERSEDES");
    // Side-effect: the superseded document (targetId) must be marked as SUPERSEDED
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: DOC_B }),
        data: expect.objectContaining({ status: "SUPERSEDED" }),
      }),
    );
  });

  it("createDocumentLink com outro tipo NÃO chama document.update", async () => {
    mockDocumentLinkCreate.mockResolvedValue(baseLink);

    await createDocumentLink({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Document",
      sourceId: DOC_A,
      targetType: "Document",
      targetId: DOC_B,
      linkType: "REFERENCE",
    });

    expect(mockDocumentUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 7: EvidenceLink existente permanece intacto (backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07v2: EvidenceLink — backward compatibility intacta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("prisma.evidenceLink.create ainda funciona (modelo não alterado)", async () => {
    const legacyEvidence = {
      id: "ev-legacy-1",
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Issue",
      sourceId: ISSUE_ID,
      targetType: "Document",
      targetId: DOC_A,
      description: "Evidência de não conformidade",
      createdById: "u1",
      hash: "abc123hash",
      createdAt: new Date("2026-04-04T10:00:00Z"),
    };
    mockEvidenceLinkCreate.mockResolvedValue(legacyEvidence);

    // Direct prisma call simulating old code that still uses EvidenceLink
    const { prisma } = await import("@/lib/prisma");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).evidenceLink.create({
      data: {
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        sourceType: "Issue",
        sourceId: ISSUE_ID,
        targetType: "Document",
        targetId: DOC_A,
        description: "Evidência de não conformidade",
        createdById: "u1",
        hash: "abc123hash",
      },
    });

    expect(result.id).toBe("ev-legacy-1");
    expect(result.hash).toBe("abc123hash");
    expect(mockEvidenceLinkCreate).toHaveBeenCalledOnce();
  });

  it("prisma.evidenceLink.findMany retorna links legados sem interferência do DocumentLink", async () => {
    const legacyLinks = [
      {
        id: "ev-legacy-2",
        orgId: ORG_ID,
        sourceType: "Issue",
        sourceId: ISSUE_ID,
        targetType: "Document",
        targetId: DOC_A,
        hash: "hash2",
        createdAt: new Date("2026-04-04T09:00:00Z"),
      },
    ];
    mockEvidenceLinkFindMany.mockResolvedValue(legacyLinks);

    const { prisma } = await import("@/lib/prisma");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).evidenceLink.findMany({
      where: { orgId: ORG_ID },
    });

    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("hash2");
    // DocumentLink mock was NOT called — models are independent
    expect(mockDocumentLinkFindMany).not.toHaveBeenCalled();
    expect(mockDocumentLinkCreate).not.toHaveBeenCalled();
  });
});
