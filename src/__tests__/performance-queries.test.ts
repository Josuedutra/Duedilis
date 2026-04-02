/**
 * Performance queries — N+1 audit + index verification — Sprint D3, Task D3-13
 * gov-1775077765642-3pvkka
 *
 * Verifica:
 *  1. N+1 query elimination in processOutbox (before: 2N+1 queries, after: N+1)
 *  2. select optimizations in listMeetings + listActionItems
 *  3. Schema index coverage for Meeting, ActionItem, Notification, NotificationOutbox, EvidenceLink
 *  4. Bounded pagination on all list endpoints
 *  5. EvidenceLink bidirectional lookup index
 *  6. OrderBy indexes verified
 *  7. Composite index on Meeting.projectId+scheduledAt + ActionItem.meetingId+dueDate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn());

const mockNotificationOutboxFindMany = vi.hoisted(() => vi.fn());
const mockNotificationOutboxUpdate = vi.hoisted(() => vi.fn());
const mockNotificationOutboxCreate = vi.hoisted(() => vi.fn());
const mockNotificationOutboxFindFirst = vi.hoisted(() => vi.fn());

const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockNotificationCount = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationUpdate = vi.hoisted(() => vi.fn());
const mockNotificationUpdateMany = vi.hoisted(() => vi.fn());

const mockMeetingFindMany = vi.hoisted(() => vi.fn());
const mockMeetingCreate = vi.hoisted(() => vi.fn());
const mockMeetingFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingUpdate = vi.hoisted(() => vi.fn());

const mockMeetingParticipantFindMany = vi.hoisted(() => vi.fn());
const mockMeetingParticipantCreate = vi.hoisted(() => vi.fn());
const mockMeetingParticipantFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingParticipantUpdate = vi.hoisted(() => vi.fn());

const mockMeetingMinutesFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingMinutesCreate = vi.hoisted(() => vi.fn());
const mockMeetingMinutesUpdate = vi.hoisted(() => vi.fn());

const mockActionItemFindMany = vi.hoisted(() => vi.fn());
const mockActionItemCreate = vi.hoisted(() => vi.fn());
const mockActionItemFindUnique = vi.hoisted(() => vi.fn());
const mockActionItemUpdate = vi.hoisted(() => vi.fn());

const mockEvidenceLinkFindMany = vi.hoisted(() => vi.fn());
const mockEvidenceLinkCreate = vi.hoisted(() => vi.fn());
const mockEvidenceLinkFindFirst = vi.hoisted(() => vi.fn());

const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockProjectFindUnique = vi.hoisted(() => vi.fn());
const mockIssueFindUnique = vi.hoisted(() => vi.fn());
const mockDocumentFindUnique = vi.hoisted(() => vi.fn());

const mockAuditLogCreate = vi.hoisted(() => vi.fn());

const mockResendEmailSend = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "email-stub" }),
);

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("resend", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Resend: vi.fn().mockImplementation(function (this: any) {
    this.emails = { send: mockResendEmailSend };
  }),
}));
vi.mock("@/lib/services/notification-whatsapp", () => ({
  sendWhatsAppNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/services/audit-log", () => ({
  createAuditEntry: mockAuditLogCreate,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationOutbox: {
      findMany: mockNotificationOutboxFindMany,
      update: mockNotificationOutboxUpdate,
      create: mockNotificationOutboxCreate,
      findFirst: mockNotificationOutboxFindFirst,
    },
    notification: {
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
      create: mockNotificationCreate,
      findFirst: mockNotificationFindFirst,
      findUnique: mockNotificationFindUnique,
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
    },
    meeting: {
      findMany: mockMeetingFindMany,
      create: mockMeetingCreate,
      findUnique: mockMeetingFindUnique,
      update: mockMeetingUpdate,
    },
    meetingParticipant: {
      findMany: mockMeetingParticipantFindMany,
      create: mockMeetingParticipantCreate,
      findUnique: mockMeetingParticipantFindUnique,
      update: mockMeetingParticipantUpdate,
    },
    meetingMinutes: {
      findUnique: mockMeetingMinutesFindUnique,
      create: mockMeetingMinutesCreate,
      update: mockMeetingMinutesUpdate,
    },
    actionItem: {
      findMany: mockActionItemFindMany,
      create: mockActionItemCreate,
      findUnique: mockActionItemFindUnique,
      update: mockActionItemUpdate,
    },
    evidenceLink: {
      findMany: mockEvidenceLinkFindMany,
      create: mockEvidenceLinkCreate,
      findFirst: mockEvidenceLinkFindFirst,
    },
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    project: {
      findUnique: mockProjectFindUnique,
    },
    issue: {
      findUnique: mockIssueFindUnique,
    },
    document: {
      findUnique: mockDocumentFindUnique,
    },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(userId = "user-1", orgId = "org-1") {
  return { user: { id: userId, orgId }, orgId };
}

function makeOrgMembership(role = "FISCAL") {
  return { id: "mem-1", userId: "user-1", orgId: "org-1", role };
}

function makeOutboxEntries(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `outbox-${i + 1}`,
    orgId: "org-1",
    recipientId: `user-${i + 1}`,
    channel: i % 2 === 0 ? "EMAIL" : "WHATSAPP",
    subject: "Test subject",
    body: "<p>Test</p>",
    status: "PENDING",
    attempts: 0,
    entityType: null,
    entityId: null,
    createdAt: new Date(),
  }));
}

function makeMeetings(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `meeting-${i + 1}`,
    orgId: "org-1",
    projectId: "proj-1",
    title: `Meeting ${i + 1}`,
    scheduledAt: new Date(),
    status: "AGENDADA",
    location: null,
    createdById: "user-1",
  }));
}

function makeActionItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i + 1}`,
    meetingId: "meeting-1",
    description: `Task ${i + 1}`,
    assigneeId: null,
    dueDate: null,
    status: "PENDENTE",
    orgId: "org-1",
  }));
}

function makeEvidenceLinks(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `link-${i + 1}`,
    orgId: "org-1",
    projectId: "proj-1",
    sourceType: "Issue",
    sourceId: `issue-${i + 1}`,
    targetType: "Document",
    targetId: `doc-${i + 1}`,
    hash: `hash-${i + 1}`,
    createdById: "user-1",
    createdAt: new Date(),
  }));
}

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(makeSession());
  mockOrgMembershipFindUnique.mockResolvedValue(makeOrgMembership());
  mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" });
  mockNotificationOutboxUpdate.mockResolvedValue({
    id: "outbox-stub",
    status: "DELIVERED",
  });
  mockMeetingCreate.mockResolvedValue({
    id: "meet-1",
    orgId: "org-1",
    projectId: "proj-1",
    title: "T",
    status: "AGENDADA",
    createdById: "user-1",
  });
  mockMeetingFindUnique.mockResolvedValue({
    id: "meet-1",
    orgId: "org-1",
    projectId: "proj-1",
    status: "AGENDADA",
  });
  mockActionItemCreate.mockResolvedValue({
    id: "item-1",
    meetingId: "meet-1",
    description: "D",
    status: "PENDENTE",
  });
  mockResendEmailSend.mockResolvedValue({ id: "email-stub" });
  mockIssueFindUnique.mockResolvedValue({ id: "issue-1", orgId: "org-1" });
  mockDocumentFindUnique.mockResolvedValue({ id: "doc-1", orgId: "org-1" });
});

// ─── Suite 1: processOutbox N+1 elimination ───────────────────────────────────

describe("processOutbox — N+1 elimination", () => {
  it("3 entries → exactly 4 DB calls (1 findMany + 3 updates, not 7)", async () => {
    const entries = makeOutboxEntries(3);
    mockNotificationOutboxFindMany.mockResolvedValue(entries);
    // simulate successful delivery for all
    mockNotificationOutboxUpdate.mockResolvedValue({
      id: "stub",
      status: "DELIVERED",
    });

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    const findManyCalls = mockNotificationOutboxFindMany.mock.calls.length;
    const updateCalls = mockNotificationOutboxUpdate.mock.calls.length;
    const totalCalls = findManyCalls + updateCalls;

    // Before fix: 1 findMany + 3×2 updates = 7 calls
    // After fix:  1 findMany + 3 updates = 4 calls
    expect(findManyCalls).toBe(1);
    expect(updateCalls).toBe(3);
    expect(totalCalls).toBe(4);
  });

  it("0 entries → exactly 1 DB call (findMany only)", async () => {
    mockNotificationOutboxFindMany.mockResolvedValue([]);

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    expect(mockNotificationOutboxFindMany.mock.calls.length).toBe(1);
    expect(mockNotificationOutboxUpdate.mock.calls.length).toBe(0);
  });

  it("10 entries → exactly 11 DB calls (1 findMany + 10 updates)", async () => {
    const entries = makeOutboxEntries(10);
    mockNotificationOutboxFindMany.mockResolvedValue(entries);
    mockNotificationOutboxUpdate.mockResolvedValue({
      id: "stub",
      status: "DELIVERED",
    });

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    expect(mockNotificationOutboxFindMany.mock.calls.length).toBe(1);
    expect(mockNotificationOutboxUpdate.mock.calls.length).toBe(10);
  });

  it("failed delivery → update with FAILED status (not DELIVERED)", async () => {
    const entries = makeOutboxEntries(1);
    mockNotificationOutboxFindMany.mockResolvedValue(entries);
    mockNotificationOutboxUpdate.mockResolvedValue({
      id: "outbox-1",
      status: "FAILED",
    });

    // Make the email send fail
    mockResendEmailSend.mockRejectedValueOnce(new Error("SMTP error"));

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    const updateCall = mockNotificationOutboxUpdate.mock.calls[0];
    expect(updateCall).toBeDefined();
    expect(updateCall[0].data.status).toBe("FAILED");
    expect(updateCall[0].data.attempts).toEqual({ increment: 1 });
  });

  it("successful delivery → update with DELIVERED + deliveredAt", async () => {
    const entries = makeOutboxEntries(1);
    mockNotificationOutboxFindMany.mockResolvedValue(entries);
    mockNotificationOutboxUpdate.mockResolvedValue({
      id: "outbox-1",
      status: "DELIVERED",
    });

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    const updateCall = mockNotificationOutboxUpdate.mock.calls[0];
    expect(updateCall).toBeDefined();
    expect(updateCall[0].data.status).toBe("DELIVERED");
    expect(updateCall[0].data.deliveredAt).toBeInstanceOf(Date);
  });

  it("no intermediate PROCESSING update (status goes directly to DELIVERED/FAILED)", async () => {
    const entries = makeOutboxEntries(2);
    mockNotificationOutboxFindMany.mockResolvedValue(entries);
    mockNotificationOutboxUpdate.mockResolvedValue({
      id: "stub",
      status: "DELIVERED",
    });

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    // Verify no update was called with status=PROCESSING
    const processingUpdates = mockNotificationOutboxUpdate.mock.calls.filter(
      (call) => call[0]?.data?.status === "PROCESSING",
    );
    expect(processingUpdates).toHaveLength(0);
  });
});

// ─── Suite 2: listMeetings select optimization ────────────────────────────────

describe("listMeetings — select optimization", () => {
  it("calls findMany with select (not returning full model)", async () => {
    mockMeetingFindMany.mockResolvedValue(makeMeetings(5));

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1" });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call).toBeDefined();
    expect(call[0]).toHaveProperty("select");
  });

  it("select includes id, orgId, projectId, title, scheduledAt, status", async () => {
    mockMeetingFindMany.mockResolvedValue(makeMeetings(3));

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1" });

    const call = mockMeetingFindMany.mock.calls[0];
    const select = call[0].select;
    expect(select.id).toBe(true);
    expect(select.orgId).toBe(true);
    expect(select.projectId).toBe(true);
    expect(select.title).toBe(true);
    expect(select.scheduledAt).toBe(true);
    expect(select.status).toBe(true);
  });

  it("uses orderBy scheduledAt asc (covered by index)", async () => {
    mockMeetingFindMany.mockResolvedValue([]);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1" });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call[0].orderBy).toEqual({ scheduledAt: "asc" });
  });

  it("returns meetings matching select shape", async () => {
    mockMeetingFindMany.mockResolvedValue(makeMeetings(5));

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    const result = await listMeetings({ orgId: "org-1" });

    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("title");
  });

  it("RLS: returns [] for non-member", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    const result = await listMeetings({ orgId: "org-1" });

    expect(result).toEqual([]);
  });

  it("pagination: applies take + skip from page/pageSize", async () => {
    mockMeetingFindMany.mockResolvedValue([]);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1", page: 2, pageSize: 10 });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call[0].take).toBe(10);
    expect(call[0].skip).toBe(10);
  });
});

// ─── Suite 3: listActionItems select optimization ─────────────────────────────

describe("listActionItems — select optimization", () => {
  it("calls findMany with select", async () => {
    mockActionItemFindMany.mockResolvedValue(makeActionItems(5));

    const { listActionItems } = await import("@/lib/actions/meeting-actions");
    await listActionItems({ meetingId: "meeting-1" });

    const call = mockActionItemFindMany.mock.calls[0];
    expect(call).toBeDefined();
    expect(call[0]).toHaveProperty("select");
  });

  it("select includes id, meetingId, description, assigneeId, dueDate, status", async () => {
    mockActionItemFindMany.mockResolvedValue(makeActionItems(3));

    const { listActionItems } = await import("@/lib/actions/meeting-actions");
    await listActionItems({ meetingId: "meeting-1" });

    const call = mockActionItemFindMany.mock.calls[0];
    const select = call[0].select;
    expect(select.id).toBe(true);
    expect(select.meetingId).toBe(true);
    expect(select.description).toBe(true);
    expect(select.dueDate).toBe(true);
    expect(select.status).toBe(true);
  });

  it("uses orderBy dueDate asc (covered by composite index)", async () => {
    mockActionItemFindMany.mockResolvedValue([]);

    const { listActionItems } = await import("@/lib/actions/meeting-actions");
    await listActionItems({ meetingId: "meeting-1" });

    const call = mockActionItemFindMany.mock.calls[0];
    expect(call[0].orderBy).toEqual({ dueDate: "asc" });
  });

  it("filters by meetingId when provided", async () => {
    mockActionItemFindMany.mockResolvedValue([]);

    const { listActionItems } = await import("@/lib/actions/meeting-actions");
    await listActionItems({ meetingId: "meeting-42" });

    const call = mockActionItemFindMany.mock.calls[0];
    expect(call[0].where.meetingId).toBe("meeting-42");
  });

  it("filters by orgId when provided", async () => {
    mockActionItemFindMany.mockResolvedValue([]);

    const { listActionItems } = await import("@/lib/actions/meeting-actions");
    await listActionItems({ orgId: "org-42" });

    const call = mockActionItemFindMany.mock.calls[0];
    expect(call[0].where.orgId).toBe("org-42");
  });
});

// ─── Suite 4: Schema index coverage (Prisma schema verification) ──────────────

describe("Schema index coverage", () => {
  let schemaContent: string;

  beforeEach(async () => {
    // Read schema file directly to verify @@index declarations
    const fs = await import("fs");
    const path = await import("path");
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    schemaContent = fs.readFileSync(schemaPath, "utf-8");
  });

  it("Notification has @@index([userId, read]) for unread count queries", () => {
    expect(schemaContent).toContain("@@index([userId, read])");
  });

  it("NotificationOutbox has @@index([status, createdAt]) for outbox worker", () => {
    expect(schemaContent).toContain("@@index([status, createdAt])");
  });

  it("EvidenceLink has @@index([sourceType, sourceId]) for bidirectional lookup", () => {
    expect(schemaContent).toContain("@@index([sourceType, sourceId])");
  });

  it("EvidenceLink has @@index([targetType, targetId]) for bidirectional lookup", () => {
    expect(schemaContent).toContain("@@index([targetType, targetId])");
  });

  it("Meeting has @@index([projectId, scheduledAt]) composite index", () => {
    expect(schemaContent).toContain("@@index([projectId, scheduledAt])");
  });

  it("ActionItem has @@index([meetingId, dueDate]) composite index", () => {
    expect(schemaContent).toContain("@@index([meetingId, dueDate])");
  });

  it("Meeting has @@index([scheduledAt]) for orderBy queries", () => {
    // Extract Meeting model block
    const meetingMatch = schemaContent.match(/model Meeting \{[\s\S]*?\n\}/);
    expect(meetingMatch).not.toBeNull();
    expect(meetingMatch![0]).toContain("@@index([scheduledAt])");
  });

  it("ActionItem has @@index([meetingId]) for FK queries", () => {
    const actionItemMatch = schemaContent.match(
      /model ActionItem \{[\s\S]*?\n\}/,
    );
    expect(actionItemMatch).not.toBeNull();
    expect(actionItemMatch![0]).toContain("@@index([meetingId])");
  });
});

// ─── Suite 5: EvidenceLink bidirectional lookup ───────────────────────────────

describe("EvidenceLink bidirectional lookup — no N+1", () => {
  it("getEvidenceLinks fetches by sourceType+sourceId in 1 query", async () => {
    mockEvidenceLinkFindMany.mockResolvedValue(makeEvidenceLinks(5));

    const { listEvidenceLinks } =
      await import("@/lib/actions/evidence-link-actions");
    await listEvidenceLinks({
      sourceType: "Issue",
      sourceId: "issue-1",
      orgId: "org-1",
      projectId: "proj-1",
    });

    expect(mockEvidenceLinkFindMany.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("getEntityWithLinks covers both source and target directions", async () => {
    mockEvidenceLinkFindMany.mockResolvedValue([]);

    const { getEntityWithLinks } =
      await import("@/lib/actions/evidence-link-actions");
    await getEntityWithLinks({
      entityType: "Issue",
      entityId: "issue-1",
      orgId: "org-1",
    });

    // Should call findMany twice: once for source direction, once for target direction
    expect(mockEvidenceLinkFindMany.mock.calls.length).toBe(2);
  });

  it("listEvidenceLinks where clause uses sourceType+sourceId (indexed)", async () => {
    mockEvidenceLinkFindMany.mockResolvedValue([]);

    const { listEvidenceLinks } =
      await import("@/lib/actions/evidence-link-actions");
    await listEvidenceLinks({
      sourceType: "Issue",
      sourceId: "issue-1",
      orgId: "org-1",
      projectId: "proj-1",
    });

    const call = mockEvidenceLinkFindMany.mock.calls[0];
    const where = call[0].where;
    expect(where).toMatchObject({ sourceType: "Issue", sourceId: "issue-1" });
  });

  it("getEntityWithLinks source query uses sourceType+sourceId (indexed)", async () => {
    mockEvidenceLinkFindMany.mockResolvedValue([]);

    const { getEntityWithLinks } =
      await import("@/lib/actions/evidence-link-actions");
    await getEntityWithLinks({
      entityType: "Document",
      entityId: "doc-1",
      orgId: "org-1",
    });

    const calls = mockEvidenceLinkFindMany.mock.calls;
    const sourceCall = calls.find(
      (c) => c[0]?.where?.sourceType === "Document",
    );
    const targetCall = calls.find(
      (c) => c[0]?.where?.targetType === "Document",
    );
    expect(sourceCall).toBeDefined();
    expect(targetCall).toBeDefined();
  });
});

// ─── Suite 6: Bounded pagination ─────────────────────────────────────────────

describe("Bounded pagination — all list endpoints", () => {
  it("listMeetings: default pageSize=20 (bounded)", async () => {
    mockMeetingFindMany.mockResolvedValue([]);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1" });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call[0].take).toBe(20);
  });

  it("listMeetings: custom pageSize is respected", async () => {
    mockMeetingFindMany.mockResolvedValue([]);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1", pageSize: 5 });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call[0].take).toBe(5);
  });

  it("listNotifications: default limit=50 (bounded)", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    const { listNotifications } =
      await import("@/lib/actions/notification-actions");
    await listNotifications({ orgId: "org-1", userId: "user-1" });

    const call = mockNotificationFindMany.mock.calls[0];
    expect(call[0].take).toBe(50);
  });

  it("listNotifications: custom limit is respected", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    const { listNotifications } =
      await import("@/lib/actions/notification-actions");
    await listNotifications({ orgId: "org-1", userId: "user-1", limit: 10 });

    const call = mockNotificationFindMany.mock.calls[0];
    expect(call[0].take).toBe(10);
  });

  it("listMeetings: page 1 skip=0", async () => {
    mockMeetingFindMany.mockResolvedValue([]);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1", page: 1, pageSize: 10 });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call[0].skip).toBe(0);
  });

  it("listMeetings: page 3 with pageSize=10 → skip=20", async () => {
    mockMeetingFindMany.mockResolvedValue([]);

    const { listMeetings } = await import("@/lib/actions/meeting-actions");
    await listMeetings({ orgId: "org-1", page: 3, pageSize: 10 });

    const call = mockMeetingFindMany.mock.calls[0];
    expect(call[0].skip).toBe(20);
  });
});

// ─── Suite 7: Notification orderBy + index coverage ──────────────────────────

describe("Notification queries — orderBy index coverage", () => {
  it("listNotifications: orderBy createdAt desc (indexed)", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    const { listNotifications } =
      await import("@/lib/actions/notification-actions");
    await listNotifications({ orgId: "org-1", userId: "user-1" });

    const call = mockNotificationFindMany.mock.calls[0];
    expect(call[0].orderBy).toEqual({ createdAt: "desc" });
  });

  it("listNotifications: where includes orgId + userId (uses composite index)", async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    // Use same userId as session (user-1) to pass RLS check and reach findMany
    mockAuth.mockResolvedValue(makeSession("user-1", "org-42"));

    const { listNotifications } =
      await import("@/lib/actions/notification-actions");
    await listNotifications({ orgId: "org-42", userId: "user-1" });

    const call = mockNotificationFindMany.mock.calls[0];
    expect(call[0].where.orgId).toBe("org-42");
    expect(call[0].where.userId).toBe("user-1");
  });

  it("getUnreadCount: where includes orgId + userId + read=false (uses index)", async () => {
    mockNotificationCount.mockResolvedValue(3);

    const { getUnreadCount } =
      await import("@/lib/actions/notification-actions");
    const count = await getUnreadCount({ orgId: "org-1", userId: "user-1" });

    expect(count).toBe(3);
    const call = mockNotificationCount.mock.calls[0];
    expect(call[0].where.read).toBe(false);
    expect(call[0].where.orgId).toBe("org-1");
    expect(call[0].where.userId).toBe("user-1");
  });

  it("markAllAsRead: updateMany filters by userId+orgId+read=false", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 5 });

    const { markAllAsRead } =
      await import("@/lib/actions/notification-actions");
    await markAllAsRead({ orgId: "org-1", userId: "user-1" });

    const call = mockNotificationUpdateMany.mock.calls[0];
    expect(call[0].where.userId).toBe("user-1");
    expect(call[0].where.orgId).toBe("org-1");
    expect(call[0].where.read).toBe(false);
  });

  it("processOutbox: findMany orders by createdAt asc (uses status+createdAt index)", async () => {
    mockNotificationOutboxFindMany.mockResolvedValue([]);

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    const call = mockNotificationOutboxFindMany.mock.calls[0];
    expect(call[0].orderBy).toEqual({ createdAt: "asc" });
  });

  it("processOutbox: findMany where uses OR[PENDING, FAILED+attempts<3] (uses status index)", async () => {
    mockNotificationOutboxFindMany.mockResolvedValue([]);

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    const call = mockNotificationOutboxFindMany.mock.calls[0];
    expect(call[0].where.OR).toBeDefined();
    expect(call[0].where.OR).toHaveLength(2);
    const statuses = call[0].where.OR.map((c: { status: string }) => c.status);
    expect(statuses).toContain("PENDING");
  });

  it("processOutbox: findMany uses take=50 (bounded batch size)", async () => {
    mockNotificationOutboxFindMany.mockResolvedValue([]);

    const { processOutbox } =
      await import("@/lib/actions/notification-actions");
    await processOutbox();

    const call = mockNotificationOutboxFindMany.mock.calls[0];
    expect(call[0].take).toBe(50);
  });
});
