"use server";

/**
 * CDE Document Revision + ValidationStamp actions — TDD stub
 * Task: gov-1775321963106-xpvw4y (D4-E3-03v2)
 *
 * Stub implementation — full implementation pending D4 schema migration
 * (DocumentRevision + ValidationStamp models).
 *
 * Functions:
 *   createDocumentRevision — create a new revision with SHA-256 checksum
 *   getRevisionHistory     — list revisions ordered by createdAt asc
 *   createValidationStamp  — create immutable validation stamp with payloadHash
 *   updateValidationStamp  — always throws (immutable)
 *   deleteValidationStamp  — always throws (immutable)
 */

import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentRevision {
  id: string;
  documentId: string;
  orgId: string;
  revisionCode: string;
  fileChecksum: string;
  storageKey: string;
  createdById: string;
  createdAt: Date;
}

export interface ValidationStamp {
  id: string;
  documentId: string;
  revisionId: string;
  orgId: string;
  payloadHash: string;
  stampedById: string;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

// ─── createDocumentRevision ───────────────────────────────────────────────────

export async function createDocumentRevision(input: {
  documentId: string;
  revisionCode: string;
  fileBuffer: Buffer;
  storageKey: string;
}): Promise<DocumentRevision> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const fileChecksum = sha256(input.fileBuffer);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revision = await (prisma as any).documentRevision.create({
    data: {
      documentId: input.documentId,
      revisionCode: input.revisionCode,
      fileChecksum,
      storageKey: input.storageKey,
      createdById: session.user.id!,
    },
  });

  // Update currentRevisionCode on Document
  await prisma.document.update({
    where: { id: input.documentId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { currentRevisionCode: input.revisionCode } as any,
  });

  return revision as DocumentRevision;
}

// ─── getRevisionHistory ───────────────────────────────────────────────────────

export async function getRevisionHistory(input: {
  documentId: string;
}): Promise<DocumentRevision[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revisions = await (prisma as any).documentRevision.findMany({
    where: { documentId: input.documentId },
    orderBy: { createdAt: "asc" },
  });

  return revisions as DocumentRevision[];
}

// ─── createValidationStamp ────────────────────────────────────────────────────

export async function createValidationStamp(input: {
  documentId: string;
  revisionId: string;
  payload: Record<string, unknown>;
}): Promise<ValidationStamp> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const payloadHash = sha256(JSON.stringify(input.payload));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stamp = await (prisma as any).validationStamp.create({
    data: {
      documentId: input.documentId,
      revisionId: input.revisionId,
      payloadHash,
      stampedById: session.user.id!,
    },
  });

  return stamp as ValidationStamp;
}

// ─── updateValidationStamp — always throws (immutable) ───────────────────────

export async function updateValidationStamp(_input: {
  stampId: string;
  payload: Record<string, unknown>;
}): Promise<never> {
  throw new Error(
    "ValidationStamp é imutável — não permitido editar após criação.",
  );
}

// ─── deleteValidationStamp — always throws (immutable) ───────────────────────

export async function deleteValidationStamp(_input: {
  stampId: string;
}): Promise<never> {
  throw new Error(
    "ValidationStamp é imutável — não permitido deletar após criação.",
  );
}
