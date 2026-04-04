// Change actions — D4-E3-12 stub implementation
// Tests in src/__tests__/app/changes/page.test.tsx mock prisma.
// Full ChangeRecord schema migration + integration comes in D4-12.
// Note: prisma.changeRecord* cast as any — models added in D4-12 migration.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── Input types ──────────────────────────────────────────────────────────────

export type ChangeType = "DESIGN" | "SCOPE" | "COST" | "SCHEDULE" | "OTHER";
export type ChangeStatus =
  | "DRAFT"
  | "OPEN"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

export interface ListChangesInput {
  orgId: string;
  projectId: string;
}

export interface GetChangeDetailInput {
  orgId: string;
  changeId: string;
}

export interface CreateChangeInput {
  orgId: string;
  projectId: string;
  title: string;
  description: string;
  type: ChangeType;
  financialImpact?: number;
}

export interface AddChangeCommentInput {
  orgId: string;
  changeId: string;
  body: string;
}

export interface TransitionChangeInput {
  orgId: string;
  changeId: string;
  toStatus: ChangeStatus;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function assertMembership(orgId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized — 401");

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } } as never,
  });

  if (!membership) throw new Error("Forbidden — sem permissão — 403");
  return membership;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function listChanges(input: ListChangesInput) {
  await assertMembership(input.orgId);

  return db.changeRecord.findMany({
    where: {
      orgId: input.orgId,
      projectId: input.projectId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getChangeDetail(input: GetChangeDetailInput) {
  await assertMembership(input.orgId);

  const change = await db.changeRecord.findUnique({
    where: { id: input.changeId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true } },
        },
      },
      linkedDocuments: {
        include: {
          document: { select: { id: true, originalName: true, status: true } },
        },
      },
    },
  });

  if (!change) throw new Error("Change not found — 404");
  return change;
}

export async function createChange(input: CreateChangeInput) {
  if (!input.title || input.title.trim() === "") {
    throw new Error("Title is required — campo obrigatório");
  }
  if (!input.description || input.description.trim() === "") {
    throw new Error("Description is required — campo obrigatório");
  }
  if (!input.type) {
    throw new Error("Type is required — campo obrigatório");
  }

  await assertMembership(input.orgId);

  return db.changeRecord.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      status: "DRAFT",
      financialImpact: input.financialImpact ?? null,
    },
  });
}

export async function addChangeComment(input: AddChangeCommentInput) {
  if (!input.body || input.body.trim() === "") {
    throw new Error("Comment body is required");
  }

  await assertMembership(input.orgId);

  const change = await db.changeRecord.findUnique({
    where: { id: input.changeId },
  });
  if (!change) throw new Error("Change not found — 404");

  const session = await auth();

  return db.changeComment.create({
    data: {
      changeId: input.changeId,
      authorId: session!.user!.id!,
      body: input.body.trim(),
    },
  });
}

export async function transitionChange(input: TransitionChangeInput) {
  await assertMembership(input.orgId);

  const change = await db.changeRecord.findUnique({
    where: { id: input.changeId },
  });
  if (!change) throw new Error("Change not found — 404");

  return db.changeRecord.update({
    where: { id: input.changeId },
    data: { status: input.toStatus },
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export function getChangeStatusBadgeConfig(status: string): {
  variant: "default" | "warning" | "success" | "error";
  label: string;
} {
  switch (status) {
    case "DRAFT":
      return { variant: "default", label: "Draft" };
    case "OPEN":
      return { variant: "warning", label: "Open" };
    case "UNDER_REVIEW":
      return { variant: "warning", label: "Under Review" };
    case "APPROVED":
      return { variant: "success", label: "Approved" };
    case "REJECTED":
      return { variant: "error", label: "Rejected" };
    case "CLOSED":
      return { variant: "default", label: "Closed" };
    default:
      return { variant: "default", label: status };
  }
}

/** Returns true if a status transition button should be visible */
export function canTransitionChange(status: string): boolean {
  return ["DRAFT", "OPEN", "UNDER_REVIEW"].includes(status);
}

/** Returns true if the comment timeline should be shown (immutable) */
export function hasImmutableComments(status: string): boolean {
  return ["APPROVED", "REJECTED", "CLOSED"].includes(status);
}
