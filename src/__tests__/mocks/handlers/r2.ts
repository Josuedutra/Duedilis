/**
 * MSW handler stubs for Cloudflare R2 (presigned URL generation + upload)
 *
 * NOTE: MSW (msw) is not yet installed in this project.
 * These are handler definitions that can be activated once msw is added as a dependency.
 * To install: pnpm add -D msw
 *
 * Pattern: mocks R2 S3-compatible API for testing upload pipeline
 * without requiring real R2 credentials.
 *
 * TODO: Add `msw` package and replace stubs with real HttpResponse handlers.
 */

// R2 mock stub — defines shape for future MSW integration
export const r2Handlers = {
  /**
   * Mock: Successful presigned URL generation
   * Simulates the upload-actions presignUpload() function returning a valid URL
   */
  presignSuccess: {
    // Internal mock — presignUpload is mocked at action level
    // This documents the expected R2 PutObject presign response shape
    uploadUrl: "https://r2.example.com/bucket/org-1/proj-1/folder-1/plan.pdf",
    key: "org-1/proj-1/folder-1/plan.pdf",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
  },

  /**
   * Mock: R2 PUT upload success (client-side upload to presigned URL)
   * Returns 200 OK after successful object upload
   */
  uploadSuccess: {
    url: "https://r2.example.com/bucket/*",
    method: "PUT",
    response: { status: 200 },
  },

  /**
   * Mock: R2 quota exceeded (413 Payload Too Large)
   * Should propagate as 400 error from upload route
   */
  quotaExceeded: {
    url: "https://r2.example.com/bucket/*",
    method: "PUT",
    response: {
      status: 413,
      body: { error: "Quota exceeded for bucket" },
    },
  },

  /**
   * Mock: R2 expired presigned URL (403 Forbidden)
   * Should trigger re-presign flow
   */
  expiredUrl: {
    url: "https://r2.example.com/bucket/*",
    method: "PUT",
    response: {
      status: 403,
      body: { error: "Request has expired" },
    },
  },
};
