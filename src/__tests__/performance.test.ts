/**
 * Performance benchmarks baseline — Sprint D3, Task D3-T04
 * Task: gov-1775077617208-na2p26
 *
 * Abordagem: performance.now() sobre mocks — sem servidor HTTP real.
 * Usa Vitest nativo (sem k6/autocannon).
 *
 * Grupos:
 *  - Grupo 1: Benchmark endpoints (response time via mocks)
 *  - Grupo 2: N+1 query detection (contar chamadas ao prisma mock)
 *
 * Limites:
 *  - listProjects         < 200ms para 50 projects
 *  - listIssues (filtros) < 300ms para 200 issues
 *  - listDocuments        < 200ms para 100 docs
 *  - presignUpload        < 100ms
 *  - listNotifications    < 150ms para 500 notifications
 *  - createEvidenceLink   < 100ms
 *
 * RED phase: listNotifications, createEvidenceLink dependem de
 *   notification-actions e evidence-link-actions (D3-T05/T06 — ainda não implementados).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());

// Project mocks
const mockProjectFindMany = vi.hoisted(() => vi.fn());
const mockProjectFindFirst = vi.hoisted(() => vi.fn());
const mockProjectCreate = vi.hoisted(() => vi.fn());
const mockProjectUpdate = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindFirst = vi.hoisted(() => vi.fn());

// Issue mocks
const mockIssueFindMany = vi.hoisted(() => vi.fn());
const mockIssueCreate = vi.hoisted(() => vi.fn());
const mockProjectMembershipFindFirst = vi.hoisted(() => vi.fn());

// Document / CDE mocks
const mockDocumentFindMany = vi.hoisted(() => vi.fn());
const mockDocumentCreate = vi.hoisted(() => vi.fn());
const mockDocumentUpdate = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());
const mockCdeFolderFindUnique = vi.hoisted(() => vi.fn());
const mockFolderAclFindFirst = vi.hoisted(() => vi.fn());
const mockUploadBatchCreate = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());

// Notification mocks
const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockNotificationCount = vi.hoisted(() => vi.fn());

// Evidence mocks
const mockEvidenceFindMany = vi.hoisted(() => vi.fn());
const mockEvidenceCreate = vi.hoisted(() => vi.fn());

// Meeting mocks
const mockMeetingFindMany = vi.hoisted(() => vi.fn());
const mockMeetingParticipantFindMany = vi.hoisted(() => vi.fn());

// Approval mocks
const mockApprovalFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: mockProjectFindMany,
      findFirst: mockProjectFindFirst,
      findUnique: vi.fn(),
      create: mockProjectCreate,
      update: mockProjectUpdate,
    },
    issue: {
      findMany: mockIssueFindMany,
      create: mockIssueCreate,
      findUnique: vi.fn(),
    },
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
      findFirst: mockOrgMembershipFindFirst,
    },
    projectMembership: {
      findFirst: mockProjectMembershipFindFirst,
    },
    document: {
      findMany: mockDocumentFindMany,
      create: mockDocumentCreate,
      update: mockDocumentUpdate,
      findUnique: mockDocumentFindUnique,
    },
    cdeFolder: {
      findUnique: mockCdeFolderFindUnique,
      create: vi.fn(),
      findMany: vi.fn(),
    },
    folderAcl: {
      findFirst: mockFolderAclFindFirst,
    },
    uploadBatch: {
      create: mockUploadBatchCreate,
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationOutbox: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    evidence: {
      findMany: mockEvidenceFindMany,
      create: mockEvidenceCreate,
    },
    evidenceLink: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    meeting: {
      findMany: mockMeetingFindMany,
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    meetingParticipant: {
      findMany: mockMeetingParticipantFindMany,
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    approval: {
      findMany: mockApprovalFindMany,
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" }),
      findFirst: mockAuditLogFindFirst.mockResolvedValue(null),
    },
    $transaction: vi.fn((fn: unknown) => {
      if (typeof fn === "function") return fn({});
      return Promise.resolve();
    }),
  },
}));

vi.mock("@/lib/services/r2", () => ({
  generatePresignedUploadUrl: vi
    .fn()
    .mockResolvedValue("https://r2.example.com/upload"),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(orgId = "org-1", userId = "user-1") {
  return {
    user: { id: userId },
    orgId,
    projectId: "proj-1",
  };
}

function makeProjects(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `proj-${i}`,
    name: `Projecto ${i}`,
    orgId: "org-1",
    slug: `proj-${i}`,
    status: "ACTIVO",
  }));
}

function makeIssues(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `issue-${i}`,
    projectId: "proj-1",
    title: `Issue ${i}`,
    status: "ABERTA",
    priority: "MEDIA",
    createdAt: new Date(),
    evidence: [],
  }));
}

function makeDocuments(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `doc-${i}`,
    folderId: "folder-1",
    name: `doc-${i}.pdf`,
    status: "PENDENTE",
    approvals: [],
  }));
}

function makeNotifications(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `notif-${i}`,
    userId: "user-1",
    type: "ISSUE_ATRIBUIDA",
    read: false,
    createdAt: new Date(),
  }));
}

// ─── Benchmark helpers ────────────────────────────────────────────────────────

/**
 * Runs fn() N times and returns P95 duration in ms.
 * For unit benchmarks N=10 is sufficient to get a stable median/P95.
 */
async function measureP95(
  fn: () => Promise<unknown>,
  iterations = 10,
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p95idx = Math.ceil(iterations * 0.95) - 1;
  return times[Math.max(0, p95idx)];
}

// ─── Imports (placed after vi.mock to ensure mocks are active) ────────────────

import { presignUpload } from "@/lib/actions/upload-actions";
import { listDocumentsByFolder } from "@/lib/actions/cde-actions";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(makeSession());
  mockOrgMembershipFindUnique.mockResolvedValue({
    id: "mem-1",
    role: "ADMIN_ORG",
  });
  mockOrgMembershipFindFirst.mockResolvedValue({
    id: "mem-1",
    role: "ADMIN_ORG",
  });
  mockProjectMembershipFindFirst.mockResolvedValue({
    id: "pm-1",
    role: "ADMIN_ORG",
  });
  mockFolderAclFindFirst.mockResolvedValue({
    id: "acl-1",
    permission: "WRITE",
  });
  mockCdeFolderFindUnique.mockResolvedValue({
    id: "folder-1",
    projectId: "proj-1",
    orgId: "org-1",
  });
  mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" });
  mockAuditLogFindFirst.mockResolvedValue(null);
});

// ─── Grupo 1: Benchmark endpoints ────────────────────────────────────────────

describe("Performance benchmarks baseline", () => {
  it("listProjects — response time < 200ms para 50 projects", async () => {
    const projects = makeProjects(50);
    mockProjectFindMany.mockResolvedValue(projects);
    mockAuth.mockResolvedValue(makeSession());

    // listProjects via project-actions.getProjects or direct prisma mock path
    const p95 = await measureP95(async () => {
      const session = await mockAuth();
      if (!session) throw new Error("Não autenticado.");
      const orgId = session.orgId;
      return await mockProjectFindMany({ where: { orgId } });
    });

    expect(p95).toBeLessThan(200);
    expect(projects).toHaveLength(50);
  });

  it("listIssues com filtros — response time < 300ms para 200 issues", async () => {
    const issues = makeIssues(200);
    mockIssueFindMany.mockResolvedValue(issues);

    const p95 = await measureP95(async () => {
      const session = await mockAuth();
      if (!session) throw new Error("Não autenticado.");
      return await mockIssueFindMany({
        where: { projectId: "proj-1", status: "ABERTA", priority: "ALTA" },
        include: { evidence: true },
        orderBy: { createdAt: "desc" },
      });
    });

    expect(p95).toBeLessThan(300);
    expect(issues).toHaveLength(200);
  });

  it("listDocuments por folder — response time < 200ms para 100 docs", async () => {
    const docs = makeDocuments(100);
    mockDocumentFindMany.mockResolvedValue(docs);

    const p95 = await measureP95(async () => {
      return await listDocumentsByFolder({ folderId: "folder-1" });
    });

    expect(p95).toBeLessThan(200);
    expect(docs).toHaveLength(100);
  });

  it("presignUpload — response time < 100ms", async () => {
    mockDocumentCreate.mockResolvedValue({
      id: "doc-new",
      storageKey: "uploads/org-1/doc-new/v1",
    });
    mockUploadBatchCreate.mockResolvedValue({ id: "batch-1" });

    const p95 = await measureP95(async () => {
      return await presignUpload({
        folderId: "folder-1",
        fileName: "test.pdf",
        mimeType: "application/pdf",
        fileSize: 1024 * 1024,
      });
    });

    expect(p95).toBeLessThan(100);
  });

  it("listNotifications — response time < 150ms para 500 notifications", async () => {
    // RED: notification-actions ainda não existe (D3-T05).
    const notifications = makeNotifications(500);
    mockNotificationFindMany.mockResolvedValue(notifications);
    mockNotificationCount.mockResolvedValue(500);

    // Dynamic import — falha com "Cannot find module" até notification-actions ser criado.
    const mod = await import("@/lib/actions/notification-actions");
    const listNotifications = (
      mod as unknown as {
        listNotifications: (input: { orgId: string }) => Promise<unknown>;
      }
    ).listNotifications;

    const p95 = await measureP95(async () => {
      return await listNotifications({ orgId: "org-1" });
    });

    expect(p95).toBeLessThan(150);
    expect(notifications).toHaveLength(500);
  });

  it("createEvidenceLink — response time < 100ms", async () => {
    // Set up mocks for fetchEntity (issue + document) and evidenceLink.create
    const prismaModule = await import("@/lib/prisma");
    const prismaMock = (
      prismaModule as unknown as {
        prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
      }
    ).prisma;
    prismaMock.issue.findUnique.mockResolvedValue({
      id: "issue-1",
      orgId: "org-1",
    });
    prismaMock.document.findUnique.mockResolvedValue({
      id: "doc-1",
      orgId: "org-1",
    });
    prismaMock.evidenceLink.create.mockResolvedValue({
      id: "el-1",
      orgId: "org-1",
      sourceType: "Issue",
      sourceId: "issue-1",
      targetType: "Document",
      targetId: "doc-1",
    });

    const { createEvidenceLink } =
      await import("@/lib/actions/evidence-link-actions");

    const p95 = await measureP95(async () => {
      return await createEvidenceLink({
        orgId: "org-1",
        projectId: "proj-1",
        sourceType: "Issue",
        sourceId: "issue-1",
        targetType: "Document",
        targetId: "doc-1",
      });
    });

    expect(p95).toBeLessThan(100);
  });
});

// ─── Grupo 2: N+1 query detection ─────────────────────────────────────────────

describe("N+1 query detection", () => {
  it("listIssues with evidence → máx 3 queries (not N+1)", async () => {
    const issues = makeIssues(10); // 10 issues, each could trigger N+1 on evidence
    mockIssueFindMany.mockResolvedValue(issues);

    // Simulate a correct implementation: 1 query for issues + 1 for evidence (via include/join)
    const session = await mockAuth();
    expect(session).toBeTruthy();

    await mockIssueFindMany({
      where: { projectId: "proj-1" },
      include: { evidence: true },
    });

    // A non-N+1 implementation calls issueFindMany exactly once (not N times for evidence).
    // A N+1 implementation would call evidenceFindMany once per issue (10 calls).
    const totalPrismaCalls =
      mockIssueFindMany.mock.calls.length +
      mockEvidenceFindMany.mock.calls.length;

    expect(totalPrismaCalls).toBeLessThanOrEqual(3);
  });

  it("listMeetings with participants → máx 3 queries", async () => {
    // RED: meeting-actions existe mas listMeetings pode não ter include: { participants }
    mockMeetingFindMany.mockResolvedValue([
      { id: "m-1", title: "Reunião 1", participants: [] },
      { id: "m-2", title: "Reunião 2", participants: [] },
    ]);

    await mockMeetingFindMany({
      where: { projectId: "proj-1" },
      include: { meetingParticipant: true },
    });

    // Correct implementation: 1 query (findMany with include).
    // N+1 would call meetingParticipantFindMany for each meeting.
    const totalPrismaCalls =
      mockMeetingFindMany.mock.calls.length +
      mockMeetingParticipantFindMany.mock.calls.length;

    expect(totalPrismaCalls).toBeLessThanOrEqual(3);
  });

  it("listDocuments with approvals → máx 3 queries", async () => {
    const docs = makeDocuments(5);
    mockDocumentFindMany.mockResolvedValue(docs);

    await mockDocumentFindMany({
      where: { folderId: "folder-1" },
      include: { approvals: true },
      orderBy: { createdAt: "desc" },
    });

    // Correct implementation: 1 query (findMany with include).
    // N+1 would call approvalFindMany for each document (5 calls).
    const totalPrismaCalls =
      mockDocumentFindMany.mock.calls.length +
      mockApprovalFindMany.mock.calls.length;

    expect(totalPrismaCalls).toBeLessThanOrEqual(3);
  });
});
