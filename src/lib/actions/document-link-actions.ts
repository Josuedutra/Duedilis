"use server";
// DocumentLink actions — D4-E3-07 stub implementation
// Tests in src/__tests__/d4-doc-links.test.ts mock prisma — this satisfies the import.
// Full DocumentLink schema migration + integration comes in D4-07.
// Note: prisma.documentLink cast as any — model added in D4-07 migration.

import { prisma } from "@/lib/prisma";

export interface CreateDocumentLinkInput {
  orgId: string;
  projectId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  isEvidence?: boolean;
}

export interface ListLinksInput {
  orgId: string;
  sourceId?: string;
  targetId?: string;
}

export interface GetEvidenceLinksInput {
  orgId: string;
  docId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function createDocumentLink(input: CreateDocumentLinkInput) {
  // Unique constraint check: reject duplicate (same source+target+linkType)
  const existing = await db.documentLink.findFirst({
    where: {
      orgId: input.orgId,
      sourceId: input.sourceId,
      targetId: input.targetId,
      linkType: input.linkType,
    },
  });

  if (existing) {
    throw new Error("DocumentLink já existe — 409 conflict");
  }

  const link = await db.documentLink.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      linkType: input.linkType,
      isEvidence: input.isEvidence ?? false,
    },
  });

  // SUPERSEDES side-effect: mark the superseded document (targetId) as SUPERSEDED
  if (input.linkType === "SUPERSEDES" && input.targetType === "Document") {
    await db.document.update({
      where: { id: input.targetId },
      data: { status: "SUPERSEDED" },
    });
  }

  return link;
}

export async function listLinksFrom(input: ListLinksInput) {
  return db.documentLink.findMany({
    where: {
      orgId: input.orgId,
      sourceId: input.sourceId,
    },
  });
}

export async function listLinksTo(input: ListLinksInput) {
  return db.documentLink.findMany({
    where: {
      orgId: input.orgId,
      targetId: input.targetId,
    },
  });
}

export async function getDocumentEvidenceLinks(input: GetEvidenceLinksInput) {
  return db.documentLink.findMany({
    where: {
      orgId: input.orgId,
      isEvidence: true,
    },
  });
}
