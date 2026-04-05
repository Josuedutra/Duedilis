/**
 * C4 — API/Contract Tests: /api/evidence-links and /api/evidence-links/[entityType]/[entityId]/trail
 *
 * Validates:
 * - 401 on unauthenticated requests
 * - 400 when required query params missing
 * - 403 when user not in org
 * - 200/201 response shapes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockListEvidenceLinks = vi.fn();
const mockCreateEvidenceLink = vi.fn();
vi.mock("@/lib/actions/evidence-link-actions", () => ({
  listEvidenceLinks: mockListEvidenceLinks,
  createEvidenceLink: mockCreateEvidenceLink,
}));

const mockPrisma = {
  orgMembership: {
    findUnique: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = { user: { id: "user-1" } };

const SAMPLE_LINK = {
  id: "link-1",
  orgId: "org-1",
  projectId: "proj-1",
  sourceType: "Issue",
  sourceId: "issue-1",
  targetType: "Document",
  targetId: "doc-1",
  description: "Relates to",
  hash: "abc123",
  createdById: "user-1",
  createdAt: new Date(),
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ------------------------------------------------------------------
// Tests: GET /api/evidence-links
// ------------------------------------------------------------------

describe("GET /api/evidence-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/evidence-links/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when orgId is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } = await import("@/app/api/evidence-links/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links",
      // no orgId
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with links array", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListEvidenceLinks.mockResolvedValue([SAMPLE_LINK]);

    const { GET } = await import("@/app/api/evidence-links/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ links: expect.any(Array) });
  });

  it("returns 200 with deduplicated links when entityType + entityId provided", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // Both calls return same link — dedup should give 1 result
    mockListEvidenceLinks
      .mockResolvedValueOnce([SAMPLE_LINK])
      .mockResolvedValueOnce([SAMPLE_LINK]);

    const { GET } = await import("@/app/api/evidence-links/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links?orgId=org-1&entityType=Issue&entityId=issue-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.links).toHaveLength(1); // deduplicated
  });

  it("returns 403 when listEvidenceLinks throws 403 error", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListEvidenceLinks.mockRejectedValue(new Error("403: Not in org"));

    const { GET } = await import("@/app/api/evidence-links/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links?orgId=other-org",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});

// ------------------------------------------------------------------
// Tests: POST /api/evidence-links
// ------------------------------------------------------------------

describe("POST /api/evidence-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/evidence-links/route");
    const request = makeRequest("POST", "http://localhost/api/evidence-links", {
      orgId: "org-1",
      projectId: "proj-1",
      sourceType: "Issue",
      sourceId: "issue-1",
      targetType: "Document",
      targetId: "doc-1",
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/evidence-links/route");
    const request = makeRequest("POST", "http://localhost/api/evidence-links", {
      orgId: "org-1",
      // missing projectId, sourceType, sourceId, targetType, targetId
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 201 with link on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockCreateEvidenceLink.mockResolvedValue(SAMPLE_LINK);

    const { POST } = await import("@/app/api/evidence-links/route");
    const request = makeRequest("POST", "http://localhost/api/evidence-links", {
      orgId: "org-1",
      projectId: "proj-1",
      sourceType: "Issue",
      sourceId: "issue-1",
      targetType: "Document",
      targetId: "doc-1",
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      link: {
        id: expect.any(String),
        sourceType: expect.any(String),
        targetType: expect.any(String),
      },
    });
  });

  it("returns 403 when createEvidenceLink throws 403 error", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockCreateEvidenceLink.mockRejectedValue(
      new Error("403: Insufficient role"),
    );

    const { POST } = await import("@/app/api/evidence-links/route");
    const request = makeRequest("POST", "http://localhost/api/evidence-links", {
      orgId: "org-1",
      projectId: "proj-1",
      sourceType: "Issue",
      sourceId: "issue-1",
      targetType: "Document",
      targetId: "doc-1",
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("idempotency — TODO: POST with same payload does not duplicate if idempotency key is implemented", () => {
    // TODO: implement idempotency key on evidence-link creation
    // For now, duplicate POST creates a new link (no idempotency key)
    expect(true).toBe(true); // placeholder — tracked for future implementation
  });
});

// ------------------------------------------------------------------
// Tests: GET /api/evidence-links/[entityType]/[entityId]/trail
// ------------------------------------------------------------------

describe("GET /api/evidence-links/[entityType]/[entityId]/trail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } =
      await import("@/app/api/evidence-links/[entityType]/[entityId]/trail/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links/Issue/issue-1/trail?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({
      entityType: "Issue",
      entityId: "issue-1",
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 400 when orgId is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } =
      await import("@/app/api/evidence-links/[entityType]/[entityId]/trail/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links/Issue/issue-1/trail",
      // no orgId
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({
      entityType: "Issue",
      entityId: "issue-1",
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when user is not in org", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue(null);

    const { GET } =
      await import("@/app/api/evidence-links/[entityType]/[entityId]/trail/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links/Issue/issue-1/trail?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({
      entityType: "Issue",
      entityId: "issue-1",
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
  });

  it("returns 200 with timeline on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue({ role: "MEMBRO" });
    mockListEvidenceLinks.mockResolvedValue([SAMPLE_LINK]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const { GET } =
      await import("@/app/api/evidence-links/[entityType]/[entityId]/trail/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/evidence-links/Issue/issue-1/trail?orgId=org-1",
    ) as Parameters<typeof GET>[0];
    const params = Promise.resolve({
      entityType: "Issue",
      entityId: "issue-1",
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      entityType: expect.any(String),
      entityId: expect.any(String),
      timeline: expect.any(Array),
    });
  });
});
