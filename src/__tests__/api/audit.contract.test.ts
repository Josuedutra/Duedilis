/**
 * C4 — API/Contract Tests: /api/audit and /api/audit/verify and /api/documents/normalize
 *
 * Validates:
 * - 401 on unauthenticated requests
 * - 400 on missing required params
 * - 403 on role check (ADMIN_ORG/AUDITOR only)
 * - 404 for non-existent entities
 * - 200 response shapes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockPrisma = {
  auditLog: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  orgMembership: {
    findUnique: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockVerifyAuditChain = vi.fn();
vi.mock("@/lib/services/audit-verify", () => ({
  verifyAuditChain: mockVerifyAuditChain,
}));

const mockNormalizeDocumentName = vi.fn();
vi.mock("@/lib/services/iso-normalization", () => ({
  normalizeDocumentName: mockNormalizeDocumentName,
}));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = { user: { id: "user-1" } };

const SAMPLE_AUDIT_ENTRY = {
  id: "entry-1",
  entityType: "Document",
  entityId: "doc-1",
  orgId: "org-1",
  action: "CREATE",
  userId: "user-1",
  user: { id: "user-1", name: "Alice", email: "alice@test.com" },
  createdAt: new Date(),
  hash: "abc123",
  payload: {},
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ------------------------------------------------------------------
// Tests: GET /api/audit
// ------------------------------------------------------------------

describe("GET /api/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/audit/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit?orgId=org-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when neither entityType+entityId nor orgId provided", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } = await import("@/app/api/audit/route");
    const request = makeRequest("GET", "http://localhost/api/audit");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when user lacks ADMIN_ORG/AUDITOR role for org query", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "MEMBRO", // insufficient role
    });

    const { GET } = await import("@/app/api/audit/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit?orgId=org-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when user is not in org at all", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/audit/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit?orgId=org-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("returns 200 with entries and total for org query when admin", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.orgMembership.findUnique.mockResolvedValue({
      userId: "user-1",
      orgId: "org-1",
      role: "ADMIN_ORG",
    });
    mockPrisma.auditLog.findMany.mockResolvedValue([SAMPLE_AUDIT_ENTRY]);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/audit/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit?orgId=org-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      entries: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
    });
  });

  it("returns empty array for entity query with no audit entries", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/audit/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit?entityType=Document&entityId=doc-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ entries: [] });
  });
});

// ------------------------------------------------------------------
// Tests: GET /api/audit/verify
// ------------------------------------------------------------------

describe("GET /api/audit/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/audit/verify/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit/verify?entityType=Document&entityId=doc-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when entityType or entityId is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } = await import("@/app/api/audit/verify/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit/verify?entityType=Document",
      // missing entityId
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when entityType is invalid", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } = await import("@/app/api/audit/verify/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit/verify?entityType=InvalidType&entityId=id-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("returns 403 when user lacks ADMIN_ORG/AUDITOR role", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.auditLog.findFirst.mockResolvedValue({
      orgId: "org-1",
      entityType: "Document",
      entityId: "doc-1",
    });
    mockPrisma.orgMembership.findUnique.mockResolvedValue({
      role: "FISCAL",
    });

    const { GET } = await import("@/app/api/audit/verify/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit/verify?entityType=Document&entityId=doc-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("returns 200 with valid:true and count:0 for entity with no audit log", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/audit/verify/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit/verify?entityType=Document&entityId=nonexistent",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ valid: true, count: 0 });
  });

  it("returns 200 with verification result for admin", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.auditLog.findFirst.mockResolvedValue({
      orgId: "org-1",
    });
    mockPrisma.orgMembership.findUnique.mockResolvedValue({
      role: "ADMIN_ORG",
    });
    mockVerifyAuditChain.mockResolvedValue({ valid: true, count: 5 });

    const { GET } = await import("@/app/api/audit/verify/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/audit/verify?entityType=Document&entityId=doc-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      valid: expect.any(Boolean),
      count: expect.any(Number),
    });
  });
});

// ------------------------------------------------------------------
// Tests: POST /api/documents/normalize
// ------------------------------------------------------------------

describe("POST /api/documents/normalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/normalize/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/documents/normalize",
      { documentId: "doc-1" },
    ) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when documentId is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const { POST } = await import("@/app/api/documents/normalize/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/documents/normalize",
      {}, // no documentId
    ) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 on invalid JSON", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const { POST } = await import("@/app/api/documents/normalize/route");
    const request = new Request("http://localhost/api/documents/normalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 404 when document not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.document.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/normalize/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/documents/normalize",
      { documentId: "nonexistent" },
    ) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 409 when document is not in PENDING state", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      status: "READY", // not PENDING
      originalName: "plan.pdf",
      folder: { name: "arch" },
      project: { name: "TestProject" },
    });

    const { POST } = await import("@/app/api/documents/normalize/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/documents/normalize",
      { documentId: "doc-1" },
    ) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with normalization result on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      status: "PENDING",
      originalName: "architectural-plan.pdf",
      folderId: "folder-arch",
      orgId: "org-1",
      folder: { name: "Architecture" },
      project: { name: "TestProject" },
    });
    mockPrisma.document.update.mockResolvedValue({
      id: "doc-1",
      status: "READY",
    });
    mockNormalizeDocumentName.mockResolvedValue({
      isoName: "TESTPROJ-ARCH-PLAN-R01.pdf",
      discipline: "ARCH",
      docType: "PLAN",
      revision: "R01",
      confidence: 0.95,
    });

    const { POST } = await import("@/app/api/documents/normalize/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/documents/normalize",
      { documentId: "doc-1" },
    ) as Parameters<typeof POST>[0];
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      documentId: expect.any(String),
      status: "READY",
      isoName: expect.any(String),
      discipline: expect.any(String),
      docType: expect.any(String),
      revision: expect.any(String),
      confidence: expect.any(Number),
    });
  });
});
