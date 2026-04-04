/**
 * Tests: health endpoint + Sentry context enrichment
 * Task: gov-1775322043512-axpr65 (D4-E3-14v2)
 *
 * Tests:
 *  1. GET /api/health → 200 with status "healthy", checks, version, timestamp
 *  2. GET /api/health → 503 when DB connection fails
 *  3. setSentryContext sets orgId tag on scope
 *  4. setSentryContext sets projectId tag on scope
 *  5. setSentryContext sets userId on scope
 *  6. addSentryBreadcrumb adds breadcrumb for API route errors
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks (must be before any vi.mock calls) ────────────────────────
const { mockScope, mockWithScope, mockAddBreadcrumb, mockQueryRaw } =
  vi.hoisted(() => {
    const mockScope = {
      setUser: vi.fn(),
      setTag: vi.fn(),
    };
    const mockWithScope = vi.fn((cb: (scope: typeof mockScope) => void) =>
      cb(mockScope),
    );
    const mockAddBreadcrumb = vi.fn();
    const mockQueryRaw = vi.fn();
    return { mockScope, mockWithScope, mockAddBreadcrumb, mockQueryRaw };
  });

vi.mock("@sentry/nextjs", () => ({
  withScope: mockWithScope,
  addBreadcrumb: mockAddBreadcrumb,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

// ─── Mock @aws-sdk/client-s3 ─────────────────────────────────────────────────
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  HeadBucketCommand: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { GET } from "@/app/api/health/route";
import { setSentryContext, addSentryBreadcrumb } from "@/lib/sentry-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function parseResponse(res: Response) {
  const body = await res.json();
  return { status: res.status, body };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: DB healthy
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    // R2 not configured (env vars absent) → treated as healthy
    delete process.env.R2_ACCOUNT_ID;
  });

  it("returns 200 with status healthy, version and timestamp when DB is up", async () => {
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(typeof body.checks.version).toBe("string");
    expect(body.checks.version.length).toBeGreaterThan(0);
    expect(typeof body.checks.timestamp).toBe("string");
    // timestamp should be a valid ISO date
    expect(() => new Date(body.checks.timestamp)).not.toThrow();
    expect(new Date(body.checks.timestamp).toISOString()).toBe(
      body.checks.timestamp,
    );
  });

  it("returns 503 with status degraded when DB connection fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("DB connection refused"));

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.db).toBe(false);
  });
});

describe("setSentryContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets orgId tag on scope", () => {
    setSentryContext({ orgId: "org-123" });

    expect(mockWithScope).toHaveBeenCalledOnce();
    expect(mockScope.setTag).toHaveBeenCalledWith("orgId", "org-123");
  });

  it("sets projectId tag on scope", () => {
    setSentryContext({ projectId: "proj-456" });

    expect(mockWithScope).toHaveBeenCalledOnce();
    expect(mockScope.setTag).toHaveBeenCalledWith("projectId", "proj-456");
  });

  it("sets userId on scope user", () => {
    setSentryContext({ userId: "user-789" });

    expect(mockWithScope).toHaveBeenCalledOnce();
    expect(mockScope.setUser).toHaveBeenCalledWith({ id: "user-789" });
  });

  it("sets all context fields when all are provided", () => {
    setSentryContext({ orgId: "org-1", projectId: "proj-2", userId: "user-3" });

    expect(mockScope.setTag).toHaveBeenCalledWith("orgId", "org-1");
    expect(mockScope.setTag).toHaveBeenCalledWith("projectId", "proj-2");
    expect(mockScope.setUser).toHaveBeenCalledWith({ id: "user-3" });
  });
});

describe("addSentryBreadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a breadcrumb for API route errors", () => {
    addSentryBreadcrumb("Unhandled error in /api/documents");

    expect(mockAddBreadcrumb).toHaveBeenCalledOnce();
    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "api",
      message: "Unhandled error in /api/documents",
      level: "error",
      data: undefined,
    });
  });

  it("includes extra data in the breadcrumb when provided", () => {
    addSentryBreadcrumb("DB error", { route: "/api/health", code: "P2002" });

    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "api",
      message: "DB error",
      level: "error",
      data: { route: "/api/health", code: "P2002" },
    });
  });
});
