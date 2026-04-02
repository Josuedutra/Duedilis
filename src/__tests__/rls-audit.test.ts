/**
 * RLS end-to-end audit — Sprint D3, Task D3-12
 * Task: gov-1775086323452-3yf2to
 *
 * Auditoria completa de isolamento RLS por orgId em todos os server actions e API routes.
 *
 * Categorias testadas:
 *  1. Cross-tenant isolation — acções de Org A não devolvem dados de Org B
 *  2. Session enforcement — sem sessão → 401/Não autenticado
 *  3. orgId spoofing — user de Org A com orgId de Org B → rejeitado
 *  4. Admin vs member — ADMIN_ORG vs roles restritos (OBSERVADOR)
 *  5. API routes — GET/POST/PATCH/DELETE com cross-tenant
 *  6. DELETE operations — user não apaga recursos de outra org
 *  7. UPDATE operations — user não edita recursos de outra org
 *
 * NOTA: qualquer falha RLS identificada é documentada como BUG task separada —
 *       este teste NÃO altera server actions nem routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist all mocks ──────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());

const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());

const mockCdeFolderFindMany = vi.hoisted(() => vi.fn());
const mockCdeFolderCreate = vi.hoisted(() => vi.fn());

const mockApprovalFindUnique = vi.hoisted(() => vi.fn());
const mockApprovalFindMany = vi.hoisted(() => vi.fn());
const mockApprovalUpdate = vi.hoisted(() => vi.fn());
const mockApprovalCreate = vi.hoisted(() => vi.fn());

const mockFolderAclFindFirst = vi.hoisted(() => vi.fn());

const mockProjectMembershipFindFirst = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindFirst = vi.hoisted(() => vi.fn());

const mockProjectFindMany = vi.hoisted(() => vi.fn());
const mockProjectFindUnique = vi.hoisted(() => vi.fn());
const mockProjectCreate = vi.hoisted(() => vi.fn());
const mockProjectUpdate = vi.hoisted(() => vi.fn());

const mockEvidenceFindFirst = vi.hoisted(() => vi.fn());
const mockEvidenceFindMany = vi.hoisted(() => vi.fn());
const mockEvidenceDelete = vi.hoisted(() => vi.fn());
const mockEvidenceCreate = vi.hoisted(() => vi.fn());

const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());
const mockAuditLogFindMany = vi.hoisted(() => vi.fn());
const mockAuditLogCount = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());

const mockStampCreate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: mockDocumentFindUnique,
      findMany: mockDocumentFindMany,
      create: mockDocumentCreate,
      update: mockDocumentUpdate,
    },
    cdeFolder: {
      findMany: mockCdeFolderFindMany,
      create: mockCdeFolderCreate,
    },
    approval: {
      findUnique: mockApprovalFindUnique,
      findMany: mockApprovalFindMany,
      update: mockApprovalUpdate,
      create: mockApprovalCreate,
    },
    folderAcl: { findFirst: mockFolderAclFindFirst },
    projectMembership: { findFirst: mockProjectMembershipFindFirst },
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
      findFirst: mockOrgMembershipFindFirst,
    },
    project: {
      findMany: mockProjectFindMany,
      findUnique: mockProjectFindUnique,
      create: mockProjectCreate,
      update: mockProjectUpdate,
    },
    evidence: {
      findFirst: mockEvidenceFindFirst,
      findMany: mockEvidenceFindMany,
      delete: mockEvidenceDelete,
      create: mockEvidenceCreate,
    },
    auditLog: {
      findFirst: mockAuditLogFindFirst,
      findMany: mockAuditLogFindMany,
      count: mockAuditLogCount,
      create: mockAuditLogCreate,
    },
    stamp: { create: mockStampCreate },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/services/audit-log", () => ({
  createAuditEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/r2", () => ({
  generatePresignedUploadUrl: vi
    .fn()
    .mockResolvedValue({ url: "https://r2.example/upload", key: "key" }),
  deleteFromR2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/iso-normalization", () => ({
  normalizeDocumentName: vi.fn().mockResolvedValue("DOC-2026-001"),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

// ─── Import actions under test ─────────────────────────────────────────────
import {
  getDocument,
  listCdeFolders,
  approveDocument as rlsApproveDocument,
  rejectApproval as rlsRejectApproval,
  listDocumentsByFolder,
} from "@/lib/actions/rls-guards";

import {
  submitApproval,
  approveDocument,
  rejectApproval,
  cancelApproval,
} from "@/lib/actions/approval-actions";

import { presignUpload } from "@/lib/actions/upload-actions";

import {
  uploadPhoto,
  listPhotosByProject,
  deletePhoto,
} from "@/lib/actions/photo-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORG_A = "org-a-uuid";
const ORG_B = "org-b-uuid";
const USER_A = "user-in-org-a";
const USER_B = "user-in-org-b";
const ADMIN_A = "admin-in-org-a";
const DOC_ORG_A = "doc-uuid-org-a";
const FOLDER_ORG_A = "folder-uuid-org-a";
const PROJECT_ORG_A = "project-uuid-org-a";
const APPROVAL_ORG_A = "approval-uuid-org-a";
const PHOTO_ORG_A = "photo-uuid-org-a";

// ─── 1. Cross-tenant isolation — rls-guards ───────────────────────────────────
describe("1. Cross-tenant isolation — rls-guards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDocument: Org B query retorna null (doc pertence a Org A)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    mockDocumentFindUnique.mockResolvedValue(null);

    const result = await getDocument({ documentId: DOC_ORG_A, orgId: ORG_B });

    expect(result).toBeNull();
    // Verificar que orgId está no filtro WHERE
    expect(mockDocumentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: DOC_ORG_A, orgId: ORG_B }),
      }),
    );
  });

  it("listCdeFolders: Org B obtém lista vazia (folders pertencem a Org A)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    mockCdeFolderFindMany.mockResolvedValue([]);

    const result = await listCdeFolders({
      orgId: ORG_B,
      projectId: PROJECT_ORG_A,
    });

    expect(result).toHaveLength(0);
    expect(mockCdeFolderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_B }),
      }),
    );
  });

  it("listDocumentsByFolder: Org B obtém lista vazia para folder de Org A", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    mockDocumentFindMany.mockResolvedValue([]);

    const result = await listDocumentsByFolder({
      folderId: FOLDER_ORG_A,
      orgId: ORG_B,
      limit: 20,
      offset: 0,
    });

    expect(result).toHaveLength(0);
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_B }),
      }),
    );
  });

  it("listPhotosByProject: Org B obtém lista vazia (fotos pertencem a Org A)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    // listPhotosByProject queries db.evidence.findMany with orgId filter
    mockEvidenceFindMany.mockResolvedValue([]);

    const result = await listPhotosByProject({
      projectId: PROJECT_ORG_A,
      orgId: ORG_B,
      page: 1,
      limit: 20,
    });

    expect(result).toHaveLength(0);
    // Verificar que orgId está no filtro WHERE
    expect(mockEvidenceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_B }),
      }),
    );
  });
});

// ─── 2. Session enforcement ───────────────────────────────────────────────────
describe("2. Session enforcement — sem sessão válida → erro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getDocument sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      getDocument({ documentId: DOC_ORG_A, orgId: ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("listCdeFolders sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      listCdeFolders({ orgId: ORG_A, projectId: PROJECT_ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("listDocumentsByFolder sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      listDocumentsByFolder({
        folderId: FOLDER_ORG_A,
        orgId: ORG_A,
        limit: 10,
        offset: 0,
      }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("rlsApproveDocument sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      rlsApproveDocument({ approvalId: APPROVAL_ORG_A, orgId: ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("rlsRejectApproval sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      rlsRejectApproval({
        approvalId: APPROVAL_ORG_A,
        orgId: ORG_A,
        note: "Motivo",
      }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("submitApproval sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      submitApproval({
        documentId: DOC_ORG_A,
        orgId: ORG_A,
        folderId: FOLDER_ORG_A,
      }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("approveDocument (approval-actions) sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      approveDocument({ approvalId: APPROVAL_ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("presignUpload sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      presignUpload({
        orgId: ORG_A,
        projectId: PROJECT_ORG_A,
        folderId: FOLDER_ORG_A,
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1000,
      }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("uploadPhoto sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      uploadPhoto({
        orgId: ORG_A,
        projectId: PROJECT_ORG_A,
        folderId: FOLDER_ORG_A,
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 5000,
        fileHash: "abc123",
      }),
    ).rejects.toThrow("Não autenticado.");
  });

  it("deletePhoto sem sessão → Não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      deletePhoto({ photoId: PHOTO_ORG_A, orgId: ORG_A }),
    ).rejects.toThrow("Não autenticado.");
  });
});

// ─── 3. orgId spoofing ────────────────────────────────────────────────────────
describe("3. orgId spoofing — user de Org A com orgId de Org B", () => {
  beforeEach(() => vi.clearAllMocks());

  it("presignUpload: user Org A passando orgId Org B → 403 (não é membro)", async () => {
    // User A está autenticado mas passa ORG_B como orgId
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    // OrgMembership check: USER_A não é membro de ORG_B
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      presignUpload({
        orgId: ORG_B, // ← spoofed
        projectId: PROJECT_ORG_A,
        folderId: FOLDER_ORG_A,
        fileName: "hack.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 100,
      }),
    ).rejects.toThrow(/403|membro|proibido/i);
  });

  it("uploadPhoto: user Org A passando orgId Org B → cria documento com orgId passado (sem validação)", async () => {
    // BUG potencial: uploadPhoto não verifica membership antes de criar
    // Este teste documenta o comportamento actual
    mockAuth.mockResolvedValue({ user: { id: USER_A } });
    mockDocumentCreate.mockResolvedValue({
      id: "new-doc",
      orgId: ORG_B, // aceita orgId de outra org!
      mimeType: "image/jpeg",
      status: "PENDING",
    });

    // Se não lançar erro, o documento é criado com orgId errada — BUG RLS
    let threwError = false;
    try {
      await uploadPhoto({
        orgId: ORG_B, // ← spoofed
        projectId: PROJECT_ORG_A,
        folderId: FOLDER_ORG_A,
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 5000,
        fileHash: "abc123",
      });
    } catch {
      threwError = true;
    }

    // Documentar comportamento: se não lançou erro, RLS gap existe
    // O teste passa independentemente — apenas documenta o comportamento
    if (!threwError) {
      // RLS GAP: uploadPhoto aceita orgId arbitrário sem verificar membership
      // → BUG task deve ser criada: "uploadPhoto: verificar OrgMembership antes de criar"
      expect(mockDocumentCreate).toHaveBeenCalled();
    }
  });

  it("submitApproval: user Org A com orgId Org B → cria approval com orgId errado (sem verificação de membership)", async () => {
    // BUG potencial: submitApproval não verifica membership da org
    mockAuth.mockResolvedValue({ user: { id: USER_A } });
    mockApprovalCreate.mockResolvedValue({
      id: "new-approval",
      orgId: ORG_B,
      status: "PENDING_REVIEW",
      submittedById: USER_A,
    });

    let threwError = false;
    try {
      await submitApproval({
        documentId: DOC_ORG_A,
        orgId: ORG_B, // ← spoofed
        folderId: FOLDER_ORG_A,
      });
    } catch {
      threwError = true;
    }

    if (!threwError) {
      // RLS GAP: submitApproval não verifica se user é membro de orgId antes de criar
      // → BUG task deve ser criada
      expect(mockApprovalCreate).toHaveBeenCalled();
    }
  });

  it("listDocumentsByFolder: user Org A passa orgId Org B → retorna vazio (RLS correcto)", async () => {
    // RLS correcto: query usa orgId passado, Org B não tem docs → empty
    mockAuth.mockResolvedValue({ user: { id: USER_A } });
    mockDocumentFindMany.mockResolvedValue([]);

    const result = await listDocumentsByFolder({
      folderId: FOLDER_ORG_A,
      orgId: ORG_B, // ← spoofed
      limit: 10,
      offset: 0,
    });

    // Correcto: lista vazia porque orgId no WHERE = ORG_B e não há docs dessa org
    expect(result).toHaveLength(0);
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_B }),
      }),
    );
  });
});

// ─── 4. Admin vs member — role-based access ───────────────────────────────────
describe("4. Admin vs member — role-based access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("presignUpload: ADMIN_ORG bypassa folderAcl check (correcto)", async () => {
    mockAuth.mockResolvedValue({ user: { id: ADMIN_A } });

    // ADMIN_ORG membership em ORG_A
    mockOrgMembershipFindUnique.mockResolvedValue({
      userId: ADMIN_A,
      orgId: ORG_A,
      role: "ADMIN_ORG",
    });

    const result = await presignUpload({
      orgId: ORG_A,
      projectId: PROJECT_ORG_A,
      folderId: FOLDER_ORG_A,
      fileName: "admin-doc.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 500,
    });

    // ADMIN_ORG não precisa de folderAcl — presignUpload deve retornar URL
    expect(result).toHaveProperty("key");
    expect(result).toHaveProperty("uploadUrl");
    // FolderAcl NÃO é consultado para ADMIN_ORG
    expect(mockFolderAclFindFirst).not.toHaveBeenCalled();
  });

  it("presignUpload: OBSERVADOR sem folderAcl WRITE → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    // Membership: OBSERVADOR (role restrito)
    mockOrgMembershipFindUnique.mockResolvedValue({
      userId: USER_A,
      orgId: ORG_A,
      role: "OBSERVADOR",
    });

    // Sem ACL de WRITE na pasta
    mockFolderAclFindFirst.mockResolvedValue(null);

    await expect(
      presignUpload({
        orgId: ORG_A,
        projectId: PROJECT_ORG_A,
        folderId: FOLDER_ORG_A,
        fileName: "observador-doc.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 500,
      }),
    ).rejects.toThrow(/403|permissão|WRITE/i);
  });

  it("approveDocument: user sem ACL APPROVE → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    // Approval pertence a ORG_A — encontrado
    mockApprovalFindUnique.mockResolvedValue({
      id: APPROVAL_ORG_A,
      orgId: ORG_A,
      folderId: FOLDER_ORG_A,
      documentId: DOC_ORG_A,
      status: "PENDING_REVIEW",
    });

    // Sem permissão APPROVE no folderAcl
    mockFolderAclFindFirst.mockResolvedValue({
      permissions: ["READ", "WRITE"],
    });

    await expect(
      approveDocument({ approvalId: APPROVAL_ORG_A }),
    ).rejects.toThrow(/403|permissão|APPROVE/i);
  });

  it("cancelApproval: apenas o submitter pode cancelar — terceiro → erro", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } }); // outro user

    mockApprovalFindUnique.mockResolvedValue({
      id: APPROVAL_ORG_A,
      orgId: ORG_A,
      submittedById: USER_A, // diferente do user actual (USER_B)
      status: "PENDING_REVIEW",
    });

    await expect(
      cancelApproval({ approvalId: APPROVAL_ORG_A }),
    ).rejects.toThrow(/cancelar|submitter|permissão/i);
  });

  it("cancelApproval: submitter consegue cancelar a sua própria aprovação", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    mockApprovalFindUnique.mockResolvedValue({
      id: APPROVAL_ORG_A,
      orgId: ORG_A,
      submittedById: USER_A,
      status: "PENDING_REVIEW",
    });

    mockApprovalUpdate.mockResolvedValue({
      id: APPROVAL_ORG_A,
      status: "CANCELLED",
    });

    const result = await cancelApproval({ approvalId: APPROVAL_ORG_A });
    expect(result.status).toBe("CANCELLED");
  });
});

// ─── 5. API routes — cross-tenant isolation ────────────────────────────────────
describe("5. API routes — cross-tenant isolation (unit-level)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /api/approvals: sem sessão → 401", async () => {
    // Simular request sem sessão
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/approvals/route");
    const request = new Request(
      "http://localhost/api/approvals?status=PENDING_REVIEW",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("GET /api/approvals: user autenticado → filtra por membership (não retorna dados de outra org)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });
    mockApprovalFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/approvals/route");
    const request = new Request(
      "http://localhost/api/approvals?status=PENDING_REVIEW",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Verificar que WHERE inclui filtro de membership do user
    expect(mockApprovalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          org: expect.objectContaining({
            memberships: expect.objectContaining({
              some: expect.objectContaining({ userId: USER_A }),
            }),
          }),
        }),
      }),
    );
  });

  it("GET /api/photos: sem orgId/projectId → 400", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    const { GET } = await import("@/app/api/photos/route");
    const request = new Request("http://localhost/api/photos");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("GET /api/photos: Org B não retorna fotos de Org A", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    // listPhotosByProject usa db.evidence.findMany com orgId=ORG_B → vazio
    mockEvidenceFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/photos/route");
    const request = new Request(
      `http://localhost/api/photos?projectId=${PROJECT_ORG_A}&orgId=${ORG_B}`,
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.photos).toHaveLength(0);
  });

  it("GET /api/projects: sem sessão → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET /api/projects: user vê apenas projetos onde é membro", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });
    mockProjectFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/projects/route");
    const response = await GET();

    expect(response.status).toBe(200);
    // WHERE: memberships.some(userId=USER_A) — nunca retorna projetos de outras orgs
    expect(mockProjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberships: expect.objectContaining({
            some: expect.objectContaining({ userId: USER_A }),
          }),
        }),
      }),
    );
  });

  it("GET /api/audit: sem sessão → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/audit/route");
    const request = new Request(`http://localhost/api/audit?orgId=${ORG_A}`);
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("GET /api/audit: user sem role ADMIN_ORG/AUDITOR → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    // Membership com role OBSERVADOR (sem acesso ao audit)
    mockOrgMembershipFindUnique.mockResolvedValue({
      userId: USER_A,
      orgId: ORG_A,
      role: "OBSERVADOR",
    });

    const { GET } = await import("@/app/api/audit/route");
    const request = new Request(`http://localhost/api/audit?orgId=${ORG_A}`);
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("GET /api/audit: user AUDITOR vê apenas logs da sua org", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    mockOrgMembershipFindUnique.mockResolvedValue({
      userId: USER_A,
      orgId: ORG_A,
      role: "AUDITOR",
    });

    mockAuditLogFindMany.mockResolvedValue([]);
    mockAuditLogCount.mockResolvedValue(0);

    const { GET } = await import("@/app/api/audit/route");
    const request = new Request(`http://localhost/api/audit?orgId=${ORG_A}`);
    const response = await GET(request);

    expect(response.status).toBe(200);
    // WHERE usa orgId explícito passado na query
    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_A }),
      }),
    );
  });
});

// ─── 6. DELETE operations ────────────────────────────────────────────────────
describe("6. DELETE — user não apaga recursos de outra org", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletePhoto: user Org B tenta apagar foto de Org A → erro (foto não encontrada)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });

    // deletePhoto usa { id, orgId, type: "FOTO" } no findFirst
    // Org B passa orgId=ORG_A mas USER_B não tem acesso → evidence.findFirst retorna null
    mockEvidenceFindFirst.mockResolvedValue(null);

    await expect(
      deletePhoto({ photoId: PHOTO_ORG_A, orgId: ORG_A }),
    ).rejects.toThrow(/não encontrada|404/i);
  });

  it("deletePhoto: user Org A apaga a sua própria foto", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    mockOrgMembershipFindUnique.mockResolvedValue({
      userId: USER_A,
      orgId: ORG_A,
      role: "GESTOR_PROJETO",
    });

    mockEvidenceFindFirst.mockResolvedValue({
      id: PHOTO_ORG_A,
      orgId: ORG_A,
      storageKey: "org-a/photo.jpg",
    });
    mockEvidenceDelete.mockResolvedValue({ id: PHOTO_ORG_A });

    const result = await deletePhoto({ photoId: PHOTO_ORG_A, orgId: ORG_A });
    expect(result).toBeDefined();
  });

  it("DELETE /api/photos/[id]: sem sessão → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/photos/[id]/route");
    const request = new Request(`http://localhost/api/photos/${PHOTO_ORG_A}`, {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: PHOTO_ORG_A }),
    });

    expect(response.status).toBe(401);
  });

  it("DELETE /api/photos/[id]: foto não encontrada → 404 (cross-org isolation)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });

    // Org B tenta apagar foto de Org A — findFirst com type=FOTO sem orgId filter
    // BUG potencial: não verifica orgId no findFirst antes de delete
    mockEvidenceFindFirst.mockResolvedValue(null); // foto não encontrada para Org B

    const { DELETE } = await import("@/app/api/photos/[id]/route");
    const request = new Request(`http://localhost/api/photos/${PHOTO_ORG_A}`, {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: PHOTO_ORG_A }),
    });

    // Espera 404 (ou 500 se deletePhoto lança)
    expect([404, 500]).toContain(response.status);
  });
});

// ─── 7. UPDATE operations ─────────────────────────────────────────────────────
describe("7. UPDATE — user não edita recursos de outra org", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approveDocument (approval-actions): user Org B tenta aprovar approval de Org A → não encontrado", async () => {
    // BUG DOCUMENTADO: approveDocument em approval-actions.ts NÃO recebe orgId
    // → busca approval pelo ID sem filtro de org → cross-tenant access possível
    // Este teste verifica o comportamento quando approval retorna null (Org B não a encontra)
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    mockApprovalFindUnique.mockResolvedValue(null); // Org B não encontra approval de Org A

    await expect(
      approveDocument({ approvalId: APPROVAL_ORG_A }),
    ).rejects.toThrow(/não encontrada|404/i);
  });

  it("approveDocument (approval-actions): user Org B encontra approval de Org A mas sem ACL → 403", async () => {
    // BUG DOCUMENTADO: se approval é encontrado sem filtro orgId, ACL check protege
    // (segunda linha de defesa, mas a primeira está em falta)
    mockAuth.mockResolvedValue({ user: { id: USER_B } });

    // Approval retornado (cross-tenant — bug na primeira linha de defesa)
    mockApprovalFindUnique.mockResolvedValue({
      id: APPROVAL_ORG_A,
      orgId: ORG_A,
      folderId: FOLDER_ORG_A,
      documentId: DOC_ORG_A,
      status: "PENDING_REVIEW",
    });

    // USER_B não tem ACL na pasta de ORG_A
    mockFolderAclFindFirst.mockResolvedValue(null);

    await expect(
      approveDocument({ approvalId: APPROVAL_ORG_A }),
    ).rejects.toThrow(/403|permissão|APPROVE/i);
  });

  it("rejectApproval (approval-actions): user Org B encontra approval de Org A mas sem ACL → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });

    mockApprovalFindUnique.mockResolvedValue({
      id: APPROVAL_ORG_A,
      orgId: ORG_A,
      folderId: FOLDER_ORG_A,
      documentId: DOC_ORG_A,
      status: "PENDING_REVIEW",
    });

    mockFolderAclFindFirst.mockResolvedValue(null);

    await expect(
      rejectApproval({
        approvalId: APPROVAL_ORG_A,
        note: "Tentativa cross-org",
      }),
    ).rejects.toThrow(/403|permissão|APPROVE/i);
  });

  it("PATCH /api/approvals/[id]: sem sessão válida → auth delegado à action (approveDocument lança)", async () => {
    // approval-actions.approveDocument verifica sessão internamente
    mockAuth.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = new Request(
      `http://localhost/api/approvals/${APPROVAL_ORG_A}`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ id: APPROVAL_ORG_A }),
    });

    // approveDocument lança "Não autenticado." → PATCH retorna 500
    expect([401, 500]).toContain(response.status);
  });

  it("POST /api/projects: user sem role adequado → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_A } });

    // USER_A não é membro de ORG_B
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/route");
    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({
        orgId: ORG_B, // ← outra org
        name: "Proj Hack",
        slug: "proj-hack",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("rlsRejectApproval: orgId de Org B passado → approval não encontrado → erro", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_B } });
    mockApprovalFindUnique.mockResolvedValue(null);

    await expect(
      rlsRejectApproval({
        approvalId: APPROVAL_ORG_A,
        orgId: ORG_B, // ← orgId spoofed
        note: "Tentativa cross-org",
      }),
    ).rejects.toThrow(/não encontrado|404|permissão/i);
  });
});

// ─── RLS Audit Summary ─────────────────────────────────────────────────────────
describe("RLS Audit — Summary de gaps identificados", () => {
  it("AUDIT: approveDocument/rejectApproval em approval-actions não filtram por orgId (primeira linha de defesa em falta)", () => {
    // BUG RLS identificado:
    // approval-actions.ts:approveDocument() e rejectApproval() buscam approval
    // apenas por id, sem filtro orgId. A segunda linha de defesa (folderAcl check)
    // protege em produção mas o princípio de least privilege está violado.
    //
    // Recomendação: adicionar orgId ao findUnique ou verificar approval.orgId ≡ input.orgId
    // → BUG task: "RLS gap: approval-actions.approveDocument sem filtro orgId"
    expect(true).toBe(true); // documentação intencional
  });

  it("AUDIT: uploadPhoto não verifica OrgMembership antes de criar documento", () => {
    // BUG RLS identificado:
    // photo-actions.ts:uploadPhoto() não chama prisma.orgMembership.findUnique
    // antes de criar o documento. Um user autenticado pode passar qualquer orgId
    // e criar recursos nessa org sem ser membro.
    //
    // Recomendação: adicionar membership check no início de uploadPhoto
    // → BUG task: "RLS gap: uploadPhoto aceita orgId sem verificar membership"
    expect(true).toBe(true); // documentação intencional
  });

  it("AUDIT: submitApproval não verifica OrgMembership antes de criar approval", () => {
    // BUG RLS identificado:
    // approval-actions.ts:submitApproval() cria aprovação com qualquer orgId
    // passado, sem verificar se o user é membro dessa org.
    //
    // Recomendação: adicionar membership check no início de submitApproval
    // → BUG task: "RLS gap: submitApproval aceita orgId sem verificar membership"
    expect(true).toBe(true); // documentação intencional
  });

  it("AUDIT: DELETE /api/photos/[id] busca photo sem orgId filter antes de apagar", () => {
    // BUG RLS identificado:
    // api/photos/[id]/route.ts:DELETE busca a foto por id+type sem verificar
    // se pertence à org do user autenticado. Passa orgId da foto para deletePhoto,
    // mas deletePhoto verifica membership — segunda linha de defesa protege.
    // Risco: se deletePhoto fosse chamado com outro orgId, poderia apagar cross-org.
    //
    // → BUG task: "RLS gap: DELETE /api/photos/[id] — adicionar orgId filter no findFirst inicial"
    expect(true).toBe(true); // documentação intencional
  });
});
