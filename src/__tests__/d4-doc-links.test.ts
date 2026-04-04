// D4-E3-07: DocumentLink Tests — create, listFrom/To, isEvidence filter
// Task: gov-1775310320099-dzre58
// TDD red phase — tests MUST fail until D4-07 implements DocumentLink actions.
//
// Cenários:
//  1. Create link REFERENCE: Doc A → Doc B, linkType=REFERENCE → sucesso
//  2. Create link EVIDENCE: Issue → Document, isEvidence=true → sucesso
//  3. Bidirectional: listLinksFrom(docA) e listLinksTo(docB) retornam o mesmo link
//  4. Filter isEvidence: getDocumentEvidenceLinks(docId) → só isEvidence=true
//  5. Unique constraint: duplicata → rejeitar
//
// NOTA: EvidenceLink (módulo 8) permanece intacto. DocumentLink é modelo ADICIONAL.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockDocumentLinkCreate = vi.hoisted(() => vi.fn());
const mockDocumentLinkFindMany = vi.hoisted(() => vi.fn());
const mockDocumentLinkFindFirst = vi.hoisted(() => vi.fn());

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
  },
}));

// Importar funções (não existem ainda — red phase)
import {
  createDocumentLink,
  listLinksFrom,
  listLinksTo,
  getDocumentEvidenceLinks,
} from "@/lib/actions/document-link-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-test-001";
const PROJECT_ID = "proj-test-001";
const DOC_A = "doc-a-001";
const DOC_B = "doc-b-002";
const ISSUE_ID = "issue-001";

const baseLinkResult = {
  id: "doclink-1",
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  sourceType: "Document",
  sourceId: DOC_A,
  targetType: "Document",
  targetId: DOC_B,
  linkType: "REFERENCE",
  isEvidence: false,
  createdById: "u1",
  createdAt: new Date("2026-04-04T10:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 1: Create link REFERENCE (Doc A → Doc B)
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07: DocumentLink — create REFERENCE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("createDocumentLink REFERENCE: Doc A → Doc B → sucesso", async () => {
    mockDocumentLinkCreate.mockResolvedValue(baseLinkResult);

    const result = await createDocumentLink({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Document",
      sourceId: DOC_A,
      targetType: "Document",
      targetId: DOC_B,
      linkType: "REFERENCE",
    });

    expect(result.id).toBe("doclink-1");
    expect(result.linkType).toBe("REFERENCE");
    expect(result.isEvidence).toBe(false);
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
// Cenário 2: Create link EVIDENCE (Issue → Document, isEvidence=true)
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07: DocumentLink — create EVIDENCE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("createDocumentLink EVIDENCE: Issue → Document, isEvidence=true → sucesso", async () => {
    const evidenceLinkResult = {
      ...baseLinkResult,
      id: "doclink-ev-1",
      sourceType: "Issue",
      sourceId: ISSUE_ID,
      targetType: "Document",
      targetId: DOC_A,
      linkType: "EVIDENCE",
      isEvidence: true,
    };
    mockDocumentLinkCreate.mockResolvedValue(evidenceLinkResult);

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
    expect(mockDocumentLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isEvidence: true,
          linkType: "EVIDENCE",
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 3: Bidirectional — listLinksFrom e listLinksTo retornam o mesmo link
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07: DocumentLink — bidirectional listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("listLinksFrom(docA) retorna o link Doc A → Doc B", async () => {
    mockDocumentLinkFindMany.mockResolvedValue([baseLinkResult]);

    const result = await listLinksFrom({
      orgId: ORG_ID,
      sourceId: DOC_A,
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe(DOC_A);
    expect(result[0].targetId).toBe(DOC_B);
    expect(mockDocumentLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: ORG_ID,
          sourceId: DOC_A,
        }),
      }),
    );
  });

  it("listLinksTo(docB) retorna o mesmo link (Doc A → Doc B)", async () => {
    mockDocumentLinkFindMany.mockResolvedValue([baseLinkResult]);

    const result = await listLinksTo({
      orgId: ORG_ID,
      targetId: DOC_B,
    });

    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe(DOC_A);
    expect(result[0].targetId).toBe(DOC_B);
    expect(mockDocumentLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: ORG_ID,
          targetId: DOC_B,
        }),
      }),
    );
  });

  it("listLinksFrom e listLinksTo retornam o mesmo link (bidirecional consistente)", async () => {
    mockDocumentLinkFindMany.mockResolvedValue([baseLinkResult]);

    const fromResults = await listLinksFrom({ orgId: ORG_ID, sourceId: DOC_A });

    mockDocumentLinkFindMany.mockResolvedValue([baseLinkResult]);

    const toResults = await listLinksTo({ orgId: ORG_ID, targetId: DOC_B });

    expect(fromResults[0].id).toBe(toResults[0].id);
    expect(fromResults[0].sourceId).toBe(DOC_A);
    expect(toResults[0].targetId).toBe(DOC_B);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 4: Filter isEvidence — getDocumentEvidenceLinks → só isEvidence=true
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07: DocumentLink — isEvidence filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("getDocumentEvidenceLinks(docId) → retorna apenas links com isEvidence=true", async () => {
    const evidenceLink = {
      ...baseLinkResult,
      id: "doclink-ev-1",
      targetId: DOC_A,
      isEvidence: true,
    };
    // Only evidence links returned (non-evidence filtered out)
    mockDocumentLinkFindMany.mockResolvedValue([evidenceLink]);

    const result = await getDocumentEvidenceLinks({
      orgId: ORG_ID,
      docId: DOC_A,
    });

    expect(result).toHaveLength(1);
    expect(result[0].isEvidence).toBe(true);
    expect(mockDocumentLinkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isEvidence: true,
        }),
      }),
    );
  });

  it("getDocumentEvidenceLinks não retorna links com isEvidence=false", async () => {
    // Non-evidence links are filtered out — return empty
    mockDocumentLinkFindMany.mockResolvedValue([]);

    const result = await getDocumentEvidenceLinks({
      orgId: ORG_ID,
      docId: DOC_B,
    });

    expect(result).toHaveLength(0);
  });

  it("getDocumentEvidenceLinks inclui tanto links where targetId=docId como sourceId=docId", async () => {
    const linkAsTarget = {
      ...baseLinkResult,
      id: "doclink-ev-target",
      targetId: DOC_A,
      sourceId: ISSUE_ID,
      sourceType: "Issue",
      isEvidence: true,
    };
    const linkAsSource = {
      ...baseLinkResult,
      id: "doclink-ev-source",
      sourceId: DOC_A,
      targetId: DOC_B,
      isEvidence: true,
    };

    mockDocumentLinkFindMany.mockResolvedValue([linkAsTarget, linkAsSource]);

    const result = await getDocumentEvidenceLinks({
      orgId: ORG_ID,
      docId: DOC_A,
    });

    expect(result.every((l: { isEvidence: boolean }) => l.isEvidence)).toBe(
      true,
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 5: Unique constraint — duplicata → rejeitar
// ─────────────────────────────────────────────────────────────────────────────

describe("D4-E3-07: DocumentLink — unique constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
  });

  it("createDocumentLink duplicata (mesmo source+target+linkType) → rejeitar", async () => {
    // Existing link found — duplicate detected
    mockDocumentLinkFindFirst.mockResolvedValue(baseLinkResult);

    await expect(
      createDocumentLink({
        orgId: ORG_ID,
        projectId: PROJECT_ID,
        sourceType: "Document",
        sourceId: DOC_A,
        targetType: "Document",
        targetId: DOC_B,
        linkType: "REFERENCE",
      }),
    ).rejects.toThrow(/duplicat|conflict|409|already exists|já existe/i);

    expect(mockDocumentLinkCreate).not.toHaveBeenCalled();
  });

  it("createDocumentLink mesmo par mas linkType diferente → permite (não é duplicata)", async () => {
    // No existing link with this exact combo
    mockDocumentLinkFindFirst.mockResolvedValue(null);
    const differentTypeLink = {
      ...baseLinkResult,
      id: "doclink-2",
      linkType: "EVIDENCE",
      isEvidence: true,
    };
    mockDocumentLinkCreate.mockResolvedValue(differentTypeLink);

    const result = await createDocumentLink({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: "Document",
      sourceId: DOC_A,
      targetType: "Document",
      targetId: DOC_B,
      linkType: "EVIDENCE",
      isEvidence: true,
    });

    expect(result.linkType).toBe("EVIDENCE");
    expect(mockDocumentLinkCreate).toHaveBeenCalledTimes(1);
  });
});
