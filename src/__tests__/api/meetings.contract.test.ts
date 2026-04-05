/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * C4 — API/Contract Tests: /api/meetings and /api/meetings/[meetingId]
 *
 * Validates:
 * - 401 on unauthenticated requests
 * - 400 on missing required fields
 * - 403 on org membership check
 * - 404 on non-existent meeting
 * - 200/201 response shapes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockListMeetings = vi.fn();
const mockCreateMeeting = vi.fn();
const mockUpdateMeeting = vi.fn();
const mockAddParticipant = vi.fn();
const mockCreateMinutes = vi.fn();
const mockPublishMinutes = vi.fn();
const mockStartMeeting = vi.fn();
const mockEndMeeting = vi.fn();
const mockCancelMeeting = vi.fn();
vi.mock("@/lib/actions/meeting-actions", () => ({
  listMeetings: mockListMeetings,
  createMeeting: mockCreateMeeting,
  updateMeeting: mockUpdateMeeting,
  addParticipant: mockAddParticipant,
  createMinutes: mockCreateMinutes,
  publishMinutes: mockPublishMinutes,
  startMeeting: mockStartMeeting,
  endMeeting: mockEndMeeting,
  cancelMeeting: mockCancelMeeting,
}));

const mockPrisma = {
  orgMembership: {
    findUnique: vi.fn(),
  },
};
const mockMeetingFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  // prisma as any used in route — handled via mockPrisma being any-castable
}));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = { user: { id: "user-1" } };

const SAMPLE_MEETING = {
  id: "meeting-1",
  orgId: "org-1",
  projectId: "proj-1",
  title: "Sprint Review",
  status: "SCHEDULED",
  scheduledAt: new Date().toISOString(),
  participants: [],
  minutes: null,
  actionItems: [],
  createdBy: { id: "user-1", name: "Alice", email: "alice@test.com" },
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ------------------------------------------------------------------
// Tests: GET /api/meetings
// ------------------------------------------------------------------

describe("GET /api/meetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/meetings/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when orgId is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } = await import("@/app/api/meetings/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with meetings array", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListMeetings.mockResolvedValue([SAMPLE_MEETING]);

    const { GET } = await import("@/app/api/meetings/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ meetings: expect.any(Array) });
  });

  it("response shape includes id, title, status", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListMeetings.mockResolvedValue([SAMPLE_MEETING]);

    const { GET } = await import("@/app/api/meetings/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    const body = await response.json();
    expect(body.meetings[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      status: expect.any(String),
    });
  });

  it("returns 403 when action service throws 403 error", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListMeetings.mockRejectedValue(new Error("403: Not a member"));

    const { GET } = await import("@/app/api/meetings/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings?orgId=other-org",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

// ------------------------------------------------------------------
// Tests: POST /api/meetings
// ------------------------------------------------------------------

describe("POST /api/meetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/meetings/route");
    const request = makeRequest("POST", "http://localhost/api/meetings", {
      orgId: "org-1",
      projectId: "proj-1",
      title: "Meeting",
      scheduledAt: new Date().toISOString(),
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/meetings/route");
    const request = makeRequest("POST", "http://localhost/api/meetings", {
      orgId: "org-1",
      // missing projectId, title, scheduledAt
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 201 with meeting on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockCreateMeeting.mockResolvedValue(SAMPLE_MEETING);

    const { POST } = await import("@/app/api/meetings/route");
    const request = makeRequest("POST", "http://localhost/api/meetings", {
      orgId: "org-1",
      projectId: "proj-1",
      title: "Sprint Review",
      scheduledAt: new Date().toISOString(),
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      meeting: {
        id: expect.any(String),
        title: expect.any(String),
      },
    });
  });
});

// ------------------------------------------------------------------
// Tests: GET /api/meetings/[meetingId]
// ------------------------------------------------------------------

describe("GET /api/meetings/[meetingId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Override prisma as any db mock for this module
    mockMeetingFindUnique.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings/meeting-1",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when meeting does not exist", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // prisma as any — the db mock returned from vi.mock returns undefined
    // We need to inject via the mocked prisma module
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).meeting = {
      findUnique: vi.fn().mockResolvedValue(null),
    };
    (prismaMock.prisma as any).orgMembership = { findUnique: vi.fn() };

    const { GET } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings/nonexistent",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({ meetingId: "nonexistent" });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when user is not in meeting org", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).meeting = {
      findUnique: vi.fn().mockResolvedValue(SAMPLE_MEETING),
    };
    (prismaMock.prisma as any).orgMembership = {
      findUnique: vi.fn().mockResolvedValue(null), // not a member
    };

    const { GET } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings/meeting-1",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
  });

  it("returns 200 with meeting on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).meeting = {
      findUnique: vi.fn().mockResolvedValue(SAMPLE_MEETING),
    };
    (prismaMock.prisma as any).orgMembership = {
      findUnique: vi.fn().mockResolvedValue({ role: "MEMBRO" }),
    };

    const { GET } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/meetings/meeting-1",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ meeting: { id: expect.any(String) } });
  });
});

// ------------------------------------------------------------------
// Tests: POST /api/meetings/[meetingId] (subactions)
// ------------------------------------------------------------------

describe("POST /api/meetings/[meetingId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/meetings/meeting-1",
      { action: "add-participant", orgId: "org-1", name: "Bob" },
    ) as Parameters<typeof POST>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await POST(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 when action is unknown", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/meetings/meeting-1",
      { action: "unknown-action" },
    ) as Parameters<typeof POST>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await POST(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 when add-participant missing orgId", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/meetings/meeting-1",
      { action: "add-participant", name: "Bob" }, // missing orgId
    ) as Parameters<typeof POST>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await POST(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 201 with participant on add-participant success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockAddParticipant.mockResolvedValue({
      id: "part-1",
      name: "Bob",
      meetingId: "meeting-1",
    });

    const { POST } = await import("@/app/api/meetings/[meetingId]/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/meetings/meeting-1",
      { action: "add-participant", orgId: "org-1", name: "Bob" },
    ) as Parameters<typeof POST>[0];
    const params = Promise.resolve({ meetingId: "meeting-1" });
    const response = await POST(request, { params });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ participant: { id: expect.any(String) } });
  });
});
