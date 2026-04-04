// D4-E3-04: Duplicate Detection — stub implementation
// Task: gov-1775310295014-592yhw
//
// This stub defines the interface for checkDuplicateDocument.
// Real integration (contentHash + semanticKey fields in Document model) comes in D4-04.
// Tests in src/__tests__/d4-duplicate.test.ts mock prisma — this file satisfies the import.

import { prisma } from "@/lib/prisma";

export interface DuplicateCheckInput {
  fileBuffer: Buffer;
  contentHash: string;
  semanticKey: string;
  projectId: string;
}

export type DuplicateCheckResult =
  | { type: "warning"; existingDocId: string }
  | { type: "conflict"; status: 409; existingDocId: string }
  | { type: "clean" };

export async function checkDuplicateDocument(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const { contentHash, semanticKey, projectId } = input;

  // 1. Check contentHash — same file content → warning (suggest review, don't block)
  const existingByHash = await prisma.document.findFirst({
    where: { contentHash, projectId },
  });
  if (existingByHash) {
    return { type: "warning", existingDocId: existingByHash.id };
  }

  // 2. Check semanticKey — same {discipline}-{docType}-{zone} → 409 Conflict
  const existingBySemantic = await prisma.document.findFirst({
    where: { semanticKey, projectId },
  });
  if (existingBySemantic) {
    return {
      type: "conflict",
      status: 409,
      existingDocId: existingBySemantic.id,
    };
  }

  // 3. Clean — no duplicates found
  return { type: "clean" };
}
