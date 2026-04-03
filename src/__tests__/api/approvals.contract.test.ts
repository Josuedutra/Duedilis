/**
 * C4 — API/Contract Tests: /api/approvals and /api/approvals/[id]
 *
 * Validates:
 * - 200 response shape on GET (authenticated)
 * - 401 on unauthenticated requests
 * - 400 on invalid PATCH body
 * - Response shape matches expected TypeScript type
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockDb = {
  approval: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockDb }));

const mockApproveDocument = vi.fn();
const mockRejectApproval = vi.fn();
const mockCancelApproval = vi.fn();
vi.mock("@/lib/actions/approval-actions", () => ({
  approveDocument: mockApproveDocument,
  rejectApproval: mockRejectApproval,
  cancelApproval: mockCancelApproval,
}));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = { user: { id: "user-1" } };

const SAMPLE_APPROVAL = {
  id: "approval-1",
  status: "PENDING_REVIEW",
  document: {
    id: "doc-1",
    originalName: "plan.pdf",
    isoName: "PRJ-ARCH-PLAN-R01.pdf",
    status: "PENDING",
  },
  submitter: { id: "user-1", name: "Alice", email: "alice@test.com" },
  reviewer: null,
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ------------------------------------------------------------------
// Tests: GET /api/approvals
// ------------------------------------------------------------------

describe("GET /api/approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/approvals/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/approvals",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with approvals array", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockDb as any).approval.findMany = vi
      .fn()
      .mockResolvedValue([SAMPLE_APPROVAL]);

    const { GET } = await import("@/app/api/approvals/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/approvals",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ approvals: expect.any(Array) });
  });

  it("response shape includes expected fields", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockDb as any).approval.findMany = vi
      .fn()
      .mockResolvedValue([SAMPLE_APPROVAL]);

    const { GET } = await import("@/app/api/approvals/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/approvals",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    const body = await response.json();
    expect(body.approvals[0]).toMatchObject({
      id: expect.any(String),
      status: expect.any(String),
      document: {
        id: expect.any(String),
        originalName: expect.any(String),
      },
    });
  });

  it("accepts projectId query param without error", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockDb as any).approval.findMany = vi.fn().mockResolvedValue([]);

    const { GET } = await import("@/app/api/approvals/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/approvals?projectId=proj-1",
    ) as Parameters<typeof GET>[0];
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

// ------------------------------------------------------------------
// Tests: PATCH /api/approvals/[id]
// ------------------------------------------------------------------

describe("PATCH /api/approvals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid JSON", async () => {
    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = new Request("http://localhost/api/approvals/approval-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 when action is unknown", async () => {
    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = makeRequest(
      "PATCH",
      "http://localhost/api/approvals/approval-1",
      { action: "invalidAction" },
    );
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when reject action is missing note field", async () => {
    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = makeRequest(
      "PATCH",
      "http://localhost/api/approvals/approval-1",
      { action: "reject" }, // note required but missing
    );
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 with validation details on schema mismatch", async () => {
    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = makeRequest(
      "PATCH",
      "http://localhost/api/approvals/approval-1",
      { action: "reject", note: "" }, // note must be min(1)
    );
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    // response should include validation details
    expect(body).toHaveProperty("error");
  });

  it("returns 200 with approval on successful approve", async () => {
    mockApproveDocument.mockResolvedValue({
      ...SAMPLE_APPROVAL,
      status: "APPROVED",
    });

    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = makeRequest(
      "PATCH",
      "http://localhost/api/approvals/approval-1",
      { action: "approve" },
    );
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ approval: { status: "APPROVED" } });
  });

  it("returns 200 with approval on successful reject with note", async () => {
    mockRejectApproval.mockResolvedValue({
      ...SAMPLE_APPROVAL,
      status: "REJECTED",
    });

    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = makeRequest(
      "PATCH",
      "http://localhost/api/approvals/approval-1",
      { action: "reject", note: "Non-conformant" },
    );
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ approval: expect.any(Object) });
  });

  it("returns 403 when action service throws 403 error", async () => {
    mockApproveDocument.mockRejectedValue(new Error("403: Not authorized"));

    const { PATCH } = await import("@/app/api/approvals/[id]/route");
    const request = makeRequest(
      "PATCH",
      "http://localhost/api/approvals/approval-1",
      { action: "approve" },
    );
    const params = Promise.resolve({ id: "approval-1" });
    const response = await PATCH(request, { params });

    expect(response.status).toBe(403);
  });
});
