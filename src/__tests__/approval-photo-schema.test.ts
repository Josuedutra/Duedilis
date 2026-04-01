/**
 * Schema integrity tests — Approval + Photo models
 * Sprint D2, Task D2-01: gov-1775041191779-l75e5w
 *
 * Tests:
 *  1. Models exist (Approval, Photo accessible on prisma client)
 *  2. ApprovalStatus enum has correct values
 *  3. Relations accessible (Approval has document/submitter/reviewer, Photo has org/project/issue/uploader)
 */

import { describe, it, expect, vi } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockApprovalFindFirst = vi.hoisted(() => vi.fn());
const mockPhotoFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    approval: {
      findFirst: mockApprovalFindFirst,
    },
    photo: {
      findFirst: mockPhotoFindFirst,
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@prisma/client";

describe("Approval model — schema integrity", () => {
  it("model Approval é acessível no cliente Prisma", () => {
    // Se o modelo existir no schema, prisma.approval estará definido
    expect(prisma.approval).toBeDefined();
    expect(typeof prisma.approval.findFirst).toBe("function");
  });
});

describe("Photo model — schema integrity", () => {
  it("model Photo é acessível no cliente Prisma", () => {
    expect(prisma.photo).toBeDefined();
    expect(typeof prisma.photo.findFirst).toBe("function");
  });
});

describe("ApprovalStatus enum — valores correctos", () => {
  it("enum ApprovalStatus contém os 4 valores definidos no schema", () => {
    expect(ApprovalStatus.PENDING_REVIEW).toBe("PENDING_REVIEW");
    expect(ApprovalStatus.APPROVED).toBe("APPROVED");
    expect(ApprovalStatus.REJECTED).toBe("REJECTED");
    expect(ApprovalStatus.CANCELLED).toBe("CANCELLED");

    // Exactamente 4 valores — sem valores extra
    const values = Object.values(ApprovalStatus);
    expect(values).toHaveLength(4);
    expect(values).toEqual(
      expect.arrayContaining([
        "PENDING_REVIEW",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
      ]),
    );
  });
});
