/**
 * Tests: Sentry context enrichment
 * Task: gov-1775311338439-h1lvf9 (D4-E3-14)
 *
 * Covers:
 * 1. Sets orgId, projectId, userId on Sentry scope (opaque IDs only)
 * 2. Never includes PII (email, name) in Sentry context
 * 3. Gracefully handles missing fields
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockSetUser, mockSetTag, mockWithScope } = vi.hoisted(() => {
  const mockSetUser = vi.fn();
  const mockSetTag = vi.fn();
  const mockWithScope = vi.fn((cb: (scope: unknown) => void) => {
    cb({ setUser: mockSetUser, setTag: mockSetTag });
  });
  return { mockSetUser, mockSetTag, mockWithScope };
});

vi.mock("@sentry/nextjs", () => ({
  withScope: mockWithScope,
}));

import { setSentryContext } from "@/lib/sentry-context";

describe("Sentry context enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets orgId tag on Sentry scope", () => {
    setSentryContext({ orgId: "org-abc123" });

    expect(mockWithScope).toHaveBeenCalledOnce();
    expect(mockSetTag).toHaveBeenCalledWith("orgId", "org-abc123");
  });

  it("sets projectId tag on Sentry scope", () => {
    setSentryContext({ projectId: "proj-xyz789" });

    expect(mockSetTag).toHaveBeenCalledWith("projectId", "proj-xyz789");
  });

  it("sets userId on Sentry scope as opaque ID", () => {
    setSentryContext({ userId: "user-def456" });

    expect(mockSetUser).toHaveBeenCalledWith({ id: "user-def456" });
  });

  it("sets all three context fields together", () => {
    setSentryContext({
      orgId: "org-abc123",
      projectId: "proj-xyz789",
      userId: "user-def456",
    });

    expect(mockSetTag).toHaveBeenCalledWith("orgId", "org-abc123");
    expect(mockSetTag).toHaveBeenCalledWith("projectId", "proj-xyz789");
    expect(mockSetUser).toHaveBeenCalledWith({ id: "user-def456" });
  });

  it("does NOT include email in Sentry user context", () => {
    setSentryContext({ userId: "user-def456" });

    const userCall = mockSetUser.mock.calls[0][0] as Record<string, unknown>;
    expect(userCall).not.toHaveProperty("email");
    expect(userCall).not.toHaveProperty("username");
    expect(userCall).not.toHaveProperty("name");
  });

  it("does NOT include PII fields as tags", () => {
    setSentryContext({
      orgId: "org-abc123",
      projectId: "proj-xyz789",
      userId: "user-def456",
    });

    const tagCalls = mockSetTag.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(tagCalls).not.toContain("email");
    expect(tagCalls).not.toContain("name");
    expect(tagCalls).not.toContain("phone");
    expect(tagCalls).not.toContain("cpf");
  });

  it("does not throw when context fields are missing", () => {
    expect(() => setSentryContext({})).not.toThrow();
    expect(() => setSentryContext({ orgId: undefined })).not.toThrow();
  });

  it("does not set user when userId is not provided", () => {
    setSentryContext({ orgId: "org-abc123" });

    expect(mockSetUser).not.toHaveBeenCalled();
  });
});
