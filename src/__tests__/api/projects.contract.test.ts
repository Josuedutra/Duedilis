/**
 * C4 — API/Contract Tests: /api/projects
 *
 * Validates:
 * - 200 response shape on GET (authenticated)
 * - 201 + response shape on POST (authenticated, role ok)
 * - 400 on missing required fields
 * - 401 on unauthenticated requests
 * - 403 when user lacks ADMIN_ORG/GESTOR_PROJETO role
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockPrisma = {
  project: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  orgMembership: {
    findUnique: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ------------------------------------------------------------------
// Helper: build a minimal Next.js Request
// ------------------------------------------------------------------

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ------------------------------------------------------------------
// Shared fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = {
  user: { id: "user-1", name: "Alice", email: "alice@test.com" },
};

const SAMPLE_PROJECT = {
  id: "proj-1",
  name: "Test Project",
  slug: "test-proj",
  orgId: "org-1",
  org: { id: "org-1", name: "Org A", slug: "org-a" },
  _count: { memberships: 3 },
  updatedAt: new Date(),
};

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/route");
    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with projects array when authenticated", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.project.findMany.mockResolvedValue([SAMPLE_PROJECT]);

    const { GET } = await import("@/app/api/projects/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ projects: expect.any(Array) });
    expect(body.projects[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    });
  });

  it("returns empty array when user has no projects", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.project.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/projects/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ projects: [] });
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/route");
    const request = makeRequest("POST", "http://localhost/api/projects", {
      orgId: "org-1",
      name: "New Project",
      slug: "new-proj",
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when required fields missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/projects/route");
    // Missing orgId, name, slug
    const request = makeRequest("POST", "http://localhost/api/projects", {
      description: "only description",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when slug is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/projects/route");
    const request = makeRequest("POST", "http://localhost/api/projects", {
      orgId: "org-1",
      name: "New Project",
      // no slug
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 403 when user lacks required role", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // User has MEMBRO role — not ADMIN_ORG or GESTOR_PROJETO
    mockPrisma.orgMembership.findUnique.mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "MEMBRO",
    });

    const { POST } = await import("@/app/api/projects/route");
    const request = makeRequest("POST", "http://localhost/api/projects", {
      orgId: "org-1",
      name: "New Project",
      slug: "new-proj",
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when user is not a member of the org", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/projects/route");
    const request = makeRequest("POST", "http://localhost/api/projects", {
      orgId: "org-other",
      name: "New Project",
      slug: "new-proj",
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 201 with project on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "ADMIN_ORG",
    });
    mockPrisma.project.create.mockResolvedValue(SAMPLE_PROJECT);

    const { POST } = await import("@/app/api/projects/route");
    const request = makeRequest("POST", "http://localhost/api/projects", {
      orgId: "org-1",
      name: "Test Project",
      slug: "test-proj",
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      project: {
        id: expect.any(String),
        name: expect.any(String),
      },
    });
  });

  it("rejects extra fields that are not schema fields (extra fields ignored, required still checked)", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/projects/route");
    // Has extra field but missing slug — should still fail 400
    const request = makeRequest("POST", "http://localhost/api/projects", {
      orgId: "org-1",
      name: "New Project",
      maliciousField: "evil",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
