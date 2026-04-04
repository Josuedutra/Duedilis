/**
 * Tests: GET /api/health
 * Task: gov-1775311338439-h1lvf9 (D4-E3-14)
 *
 * Covers:
 * 1. Returns 200 with status "healthy" when DB and R2 accessible
 * 2. Returns 503 with status "degraded" when DB fails
 * 3. Returns 503 with status "degraded" when R2 fails
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

// Mock S3Client
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  HeadBucketCommand: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { S3Client } from "@aws-sdk/client-s3";

async function importRoute() {
  // Re-import to pick up fresh mocks
  const mod = await import("@/app/api/health/route");
  return mod;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Default: R2 not configured (avoids network calls)
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
  });

  it("returns 200 with status healthy when DB is accessible", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.db).toBe(true);
    expect(typeof body.checks.timestamp).toBe("string");
    expect(typeof body.checks.version).toBe("string");
  });

  it("returns 503 with status degraded when DB fails", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error("DB connection refused"),
    );

    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.db).toBe(false);
  });

  it("returns 503 with status degraded when R2 fails", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";

    vi.mocked(S3Client).mockImplementationOnce(
      () =>
        ({
          send: vi.fn().mockRejectedValue(new Error("bucket not found")),
        }) as unknown as S3Client,
    );

    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.r2).toBe(false);
  });

  it("treats R2 as healthy when R2 env vars are missing", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);
    // No R2 env vars set (cleared in beforeEach)

    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.r2).toBe(true);
  });

  it("response includes timestamp as ISO string", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();

    expect(() => new Date(body.checks.timestamp)).not.toThrow();
    expect(new Date(body.checks.timestamp).toISOString()).toBe(
      body.checks.timestamp,
    );
  });
});
