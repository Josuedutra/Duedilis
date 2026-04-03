/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * C4 — API/Contract Tests: /api/photos and /api/photos/[id]
 *
 * Photos route uses Zod schema — validates:
 * - 401 without auth
 * - 400 on Zod validation failure (wrong types, missing fields)
 * - 404 for non-existent photo
 * - 200/201 response shapes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockUploadPhoto = vi.fn();
const mockListPhotosByProject = vi.fn();
const mockDeletePhoto = vi.fn();
vi.mock("@/lib/actions/photo-actions", () => ({
  uploadPhoto: mockUploadPhoto,
  listPhotosByProject: mockListPhotosByProject,
  deletePhoto: mockDeletePhoto,
}));

const mockPrisma = {
  evidence: {
    findFirst: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const AUTHED_SESSION = { user: { id: "user-1" } };

const VALID_PHOTO_BODY = {
  orgId: "org-1",
  projectId: "proj-1",
  folderId: "folder-1",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSizeBytes: 2048,
  fileHash: "sha256-abc123",
};

const SAMPLE_PHOTO = {
  id: "evidence-1",
  orgId: "org-1",
  type: "FOTO",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSizeBytes: 2048,
  fileHash: "sha256-abc123",
  gpsMetadata: null,
  issue: null,
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ------------------------------------------------------------------
// Tests: POST /api/photos
// ------------------------------------------------------------------

describe("POST /api/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("@/app/api/photos/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/photos",
      VALID_PHOTO_BODY,
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when required field is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/photos/route");
    const request = makeRequest("POST", "http://localhost/api/photos", {
      orgId: "org-1",
      // missing projectId, folderId, etc.
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 with Zod details when fileSizeBytes is not a number", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/photos/route");
    const request = makeRequest("POST", "http://localhost/api/photos", {
      ...VALID_PHOTO_BODY,
      fileSizeBytes: "not-a-number", // wrong type
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("details"); // Zod flatten
  });

  it("returns 400 on invalid JSON body", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { POST } = await import("@/app/api/photos/route");
    const request = new Request("http://localhost/api/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 201 with photo on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockUploadPhoto.mockResolvedValue(SAMPLE_PHOTO);

    const { POST } = await import("@/app/api/photos/route");
    const request = makeRequest(
      "POST",
      "http://localhost/api/photos",
      VALID_PHOTO_BODY,
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      photo: {
        id: expect.any(String),
      },
    });
  });
});

// ------------------------------------------------------------------
// Tests: GET /api/photos
// ------------------------------------------------------------------

describe("GET /api/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/photos/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/photos?projectId=proj-1&orgId=org-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when projectId or orgId is missing", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);

    const { GET } = await import("@/app/api/photos/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/photos?projectId=proj-1",
      // missing orgId
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with photos array", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListPhotosByProject.mockResolvedValue([SAMPLE_PHOTO]);

    const { GET } = await import("@/app/api/photos/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/photos?projectId=proj-1&orgId=org-1",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ photos: expect.any(Array) });
  });
});

// ------------------------------------------------------------------
// Tests: GET /api/photos/[id]
// ------------------------------------------------------------------

describe("GET /api/photos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/photos/[id]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/photos/evidence-1",
    );
    const params = Promise.resolve({ id: "evidence-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when photo not found", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    // prisma as any in route — inject via module
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).evidence = {
      findFirst: vi.fn().mockResolvedValue(null),
    };

    const { GET } = await import("@/app/api/photos/[id]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/photos/nonexistent",
    );
    const params = Promise.resolve({ id: "nonexistent" });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 with photo on success", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).evidence = {
      findFirst: vi.fn().mockResolvedValue(SAMPLE_PHOTO),
    };

    const { GET } = await import("@/app/api/photos/[id]/route");
    const request = makeRequest(
      "GET",
      "http://localhost/api/photos/evidence-1",
    );
    const params = Promise.resolve({ id: "evidence-1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ photo: { id: expect.any(String) } });
  });
});

// ------------------------------------------------------------------
// Tests: DELETE /api/photos/[id]
// ------------------------------------------------------------------

describe("DELETE /api/photos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/photos/[id]/route");
    const request = makeRequest(
      "DELETE",
      "http://localhost/api/photos/evidence-1",
    );
    const params = Promise.resolve({ id: "evidence-1" });
    const response = await DELETE(request, { params });

    expect(response.status).toBe(401);
  });

  it("returns 404 when photo not found before delete", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).evidence = {
      findFirst: vi.fn().mockResolvedValue(null),
    };

    const { DELETE } = await import("@/app/api/photos/[id]/route");
    const request = makeRequest(
      "DELETE",
      "http://localhost/api/photos/nonexistent",
    );
    const params = Promise.resolve({ id: "nonexistent" });
    const response = await DELETE(request, { params });

    expect(response.status).toBe(404);
  });

  it("returns 200 on successful delete", async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const prismaMock = await import("@/lib/prisma");
    (prismaMock.prisma as any).evidence = {
      findFirst: vi.fn().mockResolvedValue({ orgId: "org-1" }),
    };
    mockDeletePhoto.mockResolvedValue({ deleted: true });

    const { DELETE } = await import("@/app/api/photos/[id]/route");
    const request = makeRequest(
      "DELETE",
      "http://localhost/api/photos/evidence-1",
    );
    const params = Promise.resolve({ id: "evidence-1" });
    const response = await DELETE(request, { params });

    expect(response.status).toBe(200);
  });
});
