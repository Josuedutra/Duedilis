"use server";
// Change actions — D4-08v2 implementation
// Changes & Claims module — lifecycle ALTERATION/CLAIM with financial impact tracking
// Note: prisma.changeRecord* cast as any — models added in migration.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setSentryContext } from "@/lib/sentry-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── Input types ──────────────────────────────────────────────────────────────

export type ChangeType = "ALTERATION" | "CLAIM";
export type ChangeStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FORMALIZED"
  | "CLOSED";

export interface ListChangesInput {
  orgId: string;
  projectId: string;
  type?: ChangeType;
  status?: ChangeStatus;
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

  setSentryContext({ orgId, userId: session.user.id });

  return membership;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function listChanges(input: ListChangesInput) {
  await assertMembership(input.orgId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    orgId: input.orgId,
    projectId: input.projectId,
  };
  if (input.type) where.type = input.type;
  if (input.status) where.status = input.status;

  return db.changeRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
// getChangeStatusBadgeConfig moved to src/lib/status-badges.ts (not a server action)
// canTransitionChange, hasImmutableComments moved to src/lib/status-badges.ts
