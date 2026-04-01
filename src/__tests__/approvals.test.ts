/**
 * Approvals tests — Sprint D2, Task D2-T03
 * Task: gov-1775041180765-0yiwrq
 *
 * Testes (red phase TDD — features ainda não implementadas):
 *  - Criar Approval: submit → PENDING_REVIEW
 *  - Aprovar: PENDING_REVIEW → APPROVED (cria Stamp + AuditLog)
 *  - Rejeitar: PENDING_REVIEW → REJECTED (note obrigatório)
 *  - Cancelar: PENDING_REVIEW → CANCELLED (só pelo submitter)
 *  - Fluxo completo: submit → approve → Document CONFIRMED
 *  - User sem permissão APPROVE → 403
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockApprovalCreate = vi.hoisted(() => vi.fn());
const mockApprovalFindUnique = vi.hoisted(() => vi.fn());
const mockApprovalUpdate = vi.hoisted(() => vi.fn());
const mockStampCreate = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockFolderAclFindFirst = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    approval: {
      create: mockApprovalCreate,
      findUnique: mockApprovalFindUnique,
      update: mockApprovalUpdate,
    },
    stamp: {
      create: mockStampCreate,
    },
    auditLog: {
      create: mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" }),
      findFirst: mockAuditLogFindFirst.mockResolvedValue(null),
    },
    document: {
      update: mockDocumentUpdate,
    },
    folderAcl: {
      findFirst: mockFolderAclFindFirst,
    },
    $transaction: mockTransaction,
  },
}));

// Importar funções a testar (não existem ainda — red phase)
import {
  submitApproval,
  approveDocument,
  rejectApproval,
  cancelApproval,
} from "@/lib/actions/approval-actions";

describe("submitApproval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve criar Approval com estado PENDING_REVIEW ao submeter", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockApprovalCreate.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      submittedById: "u1",
      status: "PENDING_REVIEW",
      createdAt: new Date(),
    });

    const result = await submitApproval({
      documentId: "doc1",
      orgId: "org1",
      folderId: "folder1",
    });

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.submittedById).toBe("u1");
    expect(mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_REVIEW",
          documentId: "doc1",
        }),
      }),
    );
  });

  it("deve rejeitar submit quando utilizador não está autenticado", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      submitApproval({
        documentId: "doc1",
        orgId: "org1",
        folderId: "folder1",
      }),
    ).rejects.toThrow();
  });
});

describe("approveDocument", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve aprovar: PENDING_REVIEW → APPROVED e criar Stamp + AuditLog", async () => {
    mockAuth.mockResolvedValue({ user: { id: "approver1" } });
    mockFolderAclFindFirst.mockResolvedValue({
      permissions: ["READ", "WRITE", "APPROVE"],
    });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      status: "PENDING_REVIEW",
      orgId: "org1",
      folderId: "folder1",
      document: { folderId: "folder1" },
    });
    mockTransaction.mockImplementation(
      async (
        fn: (tx: {
          approval: { update: typeof mockApprovalUpdate };
          stamp: { create: typeof mockStampCreate };
          auditLog: { create: typeof mockAuditLogCreate };
        }) => Promise<unknown>,
      ) => {
        return fn({
          approval: { update: mockApprovalUpdate },
          stamp: { create: mockStampCreate },
          auditLog: { create: mockAuditLogCreate },
        });
      },
    );
    mockApprovalUpdate.mockResolvedValue({
      id: "approval1",
      status: "APPROVED",
    });
    mockStampCreate.mockResolvedValue({ id: "stamp1" });
    mockAuditLogCreate.mockResolvedValue({ id: "log1" });

    const result = await approveDocument({ approvalId: "approval1" });

    expect(result.status).toBe("APPROVED");
    expect(mockStampCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
  });

  it("deve negar aprovação a user sem permissão APPROVE na pasta → 403", async () => {
    mockAuth.mockResolvedValue({ user: { id: "viewer1" } });
    mockFolderAclFindFirst.mockResolvedValue({
      permissions: ["READ"], // sem APPROVE
    });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      status: "PENDING_REVIEW",
      orgId: "org1",
      folderId: "folder1",
      document: { folderId: "folder1" },
    });

    await expect(approveDocument({ approvalId: "approval1" })).rejects.toThrow(
      /403|permissão|autorização/i,
    );
  });
});

describe("rejectApproval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve rejeitar: PENDING_REVIEW → REJECTED com note obrigatório", async () => {
    mockAuth.mockResolvedValue({ user: { id: "approver1" } });
    mockFolderAclFindFirst.mockResolvedValue({
      permissions: ["READ", "APPROVE"],
    });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      status: "PENDING_REVIEW",
      orgId: "org1",
      folderId: "folder1",
      document: { folderId: "folder1" },
    });
    mockTransaction.mockImplementation(
      async (
        fn: (tx: {
          approval: { update: typeof mockApprovalUpdate };
          stamp: { create: typeof mockStampCreate };
          auditLog: { create: typeof mockAuditLogCreate };
        }) => Promise<unknown>,
      ) => {
        return fn({
          approval: { update: mockApprovalUpdate },
          stamp: { create: mockStampCreate },
          auditLog: { create: mockAuditLogCreate },
        });
      },
    );
    mockApprovalUpdate.mockResolvedValue({
      id: "approval1",
      status: "REJECTED",
    });
    mockStampCreate.mockResolvedValue({ id: "stamp2" });
    mockAuditLogCreate.mockResolvedValue({ id: "log2" });

    const result = await rejectApproval({
      approvalId: "approval1",
      note: "Falta o carimbo do responsável de obra.",
    });

    expect(result.status).toBe("REJECTED");
    // Stamp deve incluir a nota
    expect(mockStampCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: "Falta o carimbo do responsável de obra.",
        }),
      }),
    );
  });

  it("deve rejeitar rejeição sem note (note é obrigatório para REJECTED)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "approver1" } });
    mockFolderAclFindFirst.mockResolvedValue({
      permissions: ["APPROVE"],
    });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      status: "PENDING_REVIEW",
      orgId: "org1",
      folderId: "folder1",
      document: { folderId: "folder1" },
    });

    await expect(
      rejectApproval({
        approvalId: "approval1",
        note: "", // note vazio — inválido
      }),
    ).rejects.toThrow(/note|motivo|obrigatório/i);
  });
});

describe("cancelApproval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve cancelar: PENDING_REVIEW → CANCELLED pelo submitter", async () => {
    mockAuth.mockResolvedValue({ user: { id: "submitter1" } });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      status: "PENDING_REVIEW",
      submittedById: "submitter1", // mesmo user
      orgId: "org1",
    });
    mockApprovalUpdate.mockResolvedValue({
      id: "approval1",
      status: "CANCELLED",
    });

    const result = await cancelApproval({ approvalId: "approval1" });

    expect(result.status).toBe("CANCELLED");
  });

  it("deve negar cancelamento por user que não é o submitter", async () => {
    mockAuth.mockResolvedValue({ user: { id: "other-user" } });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      status: "PENDING_REVIEW",
      submittedById: "submitter1", // utilizador diferente
      orgId: "org1",
    });

    await expect(cancelApproval({ approvalId: "approval1" })).rejects.toThrow(
      /cancelar|submitter|permissão/i,
    );
  });
});

describe("Fluxo completo de aprovação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve actualizar Document para CONFIRMED após aprovação bem-sucedida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "approver1" } });
    mockFolderAclFindFirst.mockResolvedValue({
      permissions: ["READ", "WRITE", "APPROVE"],
    });
    mockApprovalFindUnique.mockResolvedValue({
      id: "approval1",
      documentId: "doc1",
      status: "PENDING_REVIEW",
      orgId: "org1",
      folderId: "folder1",
      document: { folderId: "folder1", status: "READY" },
    });
    mockTransaction.mockImplementation(
      async (
        fn: (tx: {
          approval: { update: typeof mockApprovalUpdate };
          stamp: { create: typeof mockStampCreate };
          auditLog: { create: typeof mockAuditLogCreate };
          document: { update: typeof mockDocumentUpdate };
        }) => Promise<unknown>,
      ) => {
        return fn({
          approval: { update: mockApprovalUpdate },
          stamp: { create: mockStampCreate },
          auditLog: { create: mockAuditLogCreate },
          document: { update: mockDocumentUpdate },
        });
      },
    );
    mockApprovalUpdate.mockResolvedValue({
      id: "approval1",
      status: "APPROVED",
    });
    mockStampCreate.mockResolvedValue({ id: "stamp3" });
    mockAuditLogCreate.mockResolvedValue({ id: "log3" });
    mockDocumentUpdate.mockResolvedValue({ id: "doc1", status: "CONFIRMED" });

    await approveDocument({ approvalId: "approval1" });

    // Document deve ser actualizado para CONFIRMED
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONFIRMED" }),
      }),
    );
  });
});
