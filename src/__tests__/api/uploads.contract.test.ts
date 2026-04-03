/**
 * C4 — API/Contract Tests: /api/uploads/presign, /api/uploads/confirm, /api/uploads/batch
 *
 * These routes use Zod schemas — validates:
 * - 401 without auth
 * - 400 on Zod schema validation failure (wrong types, missing fields, extra fields)
 * - 200/201 response shape on success
 * - 404 for missing resources (confirm with unknown storageKey)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockPresignUpload = vi.fn();
const mockCreateUploadBatch = vi.fn();
const mockConfirmBatch = vi.fn();
vi.mock("@/lib/actions/upload-actions", () => ({
  presignUpload: mockPresignUpload,
  createUploadBatch: mockCreateUploadBatch,
  confirmBatch: mockConfirmBatch,
}));

const mockPrisma = {
  document: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockCreateAuditEntry = vi.fn();
vi.mock("@/lib/services/audit-log", () => ({
  createAuditEntry: mockCreateAuditEntry,
}));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = { user: { id: "user-1" } };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const VALID_PRESIGN_BODY = {
  orgId: "org-1",
  projectId: "proj-1",
  folderId: "folder-1",
  fileName: "plan.pdf",
  fileSizeBytes: 1024,
  mimeType: "application/pdf",
};

// ------------------------------------------------------------------
// Tests: POST /api/uploads/presign
// ------------------------------------------------------------------

describe("POST /api/uploads/presign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/uploads/presign/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/presign",
      VALID_PRESIGN_BODY,
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when required field is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/presign/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/presign",
      {
        orgId: "org-1",
        // missing projectId, folderId, etc.
      },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when fileSizeBytes is a string instead of number", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/presign/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/presign",
      {
        ...VALID_PRESIGN_BODY,
        fileSizeBytes: "large", // wrong type
      },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("details"); // Zod flatten details
  });

  it("returns 400 when fileSizeBytes exceeds 100MB limit", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/presign/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/presign",
      {
        ...VALID_PRESIGN_BODY,
        fileSizeBytes: 200 * 1024 * 1024, // 200MB — over limit
      },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/presign/route");
    const request = new Request("http://localhost/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 200 with uploadUrl, storageKey, expiresAt on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPresignUpload.mockResolvedValue({
      uploadUrl: "https://r2.example.com/upload",
      key: "org-1/proj-1/folder-1/plan.pdf",
      expiresAt: new Date(Date.now() + 900_000),
    });

    const { POST } = await import("@/app/api/uploads/presign/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/presign",
      VALID_PRESIGN_BODY,
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      uploadUrl: expect.any(String),
      storageKey: expect.any(String),
      expiresAt: expect.any(String),
    });
  });
});

// ------------------------------------------------------------------
// Tests: POST /api/uploads/confirm
// ------------------------------------------------------------------

describe("POST /api/uploads/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/uploads/confirm/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/confirm",
      { storageKey: "key", fileHash: "abc123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when storageKey is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/confirm/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/confirm",
      { fileHash: "abc123" }, // missing storageKey
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 when document not found for storageKey", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/uploads/confirm/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/confirm",
      { storageKey: "nonexistent-key", fileHash: "abc123" },
    );
    const response = await POST(request);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when hash does not match", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.document.findFirst.mockResolvedValue({
      id: "doc-1",
      orgId: "org-1",
      storageKey: "correct-key",
      fileHash: "expected-hash",
      status: "UPLOAD_PENDING",
    });

    const { POST } = await import("@/app/api/uploads/confirm/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/confirm",
      { storageKey: "correct-key", fileHash: "wrong-hash" },
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.stringContaining("mismatch") });
  });

  it("returns 200 with document id and status on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockPrisma.document.findFirst.mockResolvedValue({
      id: "doc-1",
      orgId: "org-1",
      storageKey: "correct-key",
      fileHash: "correct-hash",
      status: "UPLOAD_PENDING",
    });
    mockPrisma.document.update.mockResolvedValue({
      id: "doc-1",
      status: "PENDING",
    });
    mockCreateAuditEntry.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/uploads/confirm/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/uploads/confirm",
      { storageKey: "correct-key", fileHash: "correct-hash" },
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      document: {
        id: expect.any(String),
        status: expect.any(String),
      },
    });
  });
});

// ------------------------------------------------------------------
// Tests: POST /api/uploads/batch
// ------------------------------------------------------------------

describe("POST /api/uploads/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/uploads/batch/route");
    const request = makeRequest("POST", "http://localhost/api/uploads/batch", {
      orgId: "org-1",
      projectId: "proj-1",
      folderId: "folder-1",
      files: [],
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when files array is empty", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/batch/route");
    const request = makeRequest("POST", "http://localhost/api/uploads/batch", {
      orgId: "org-1",
      projectId: "proj-1",
      folderId: "folder-1",
      files: [], // min(1) required
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when files array exceeds 50 items", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const files = Array.from({ length: 51 }, (_, i) => ({
      fileName: `file${i}.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      fileHash: `hash${i}`,
    }));

    const { POST } = await import("@/app/api/uploads/batch/route");
    const request = makeRequest("POST", "http://localhost/api/uploads/batch", {
      orgId: "org-1",
      projectId: "proj-1",
      folderId: "folder-1",
      files,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when file item missing fileName", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/uploads/batch/route");
    const request = makeRequest("POST", "http://localhost/api/uploads/batch", {
      orgId: "org-1",
      projectId: "proj-1",
      folderId: "folder-1",
      files: [
        {
          // missing fileName
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
          fileHash: "abc",
        },
      ],
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("details"); // Zod flatten
  });

  it("returns 201 with batchId and presignedUrls on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockCreateUploadBatch.mockResolvedValue({
      batchId: "batch-1",
      presignedUrls: ["https://r2.example.com/upload/1"],
    });

    const { POST } = await import("@/app/api/uploads/batch/route");
    const request = makeRequest("POST", "http://localhost/api/uploads/batch", {
      orgId: "org-1",
      projectId: "proj-1",
      folderId: "folder-1",
      files: [
        {
          fileName: "plan.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
          fileHash: "abc123",
        },
      ],
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      batchId: expect.any(String),
      presignedUrls: expect.any(Array),
    });
  });
});
