// D4-04: Duplicate Detection — server-side hash recomputation
// Task: gov-1775322183875-sb9nic

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export interface DuplicateCheckInput {
  fileBuffer: Buffer;
  contentHash: string; // client-supplied hash (ignored — server recomputes)
  semanticKey: string;
  projectId: string;
}

export type DuplicateCheckResult =
  | { type: "warning"; existingDocId: string }
  | { type: "conflict"; status: 409; existingDocId: string }
  | { type: "clean" };

/**
 * Check for duplicate documents by server-computed contentHash and semanticKey.
 * The client-supplied contentHash is ignored — server always recomputes from fileBuffer.
 */
export async function checkDuplicateDocument(
  input: DuplicateCheckInput,
): Promise<DuplicateCheckResult> {
  const { fileBuffer, semanticKey, projectId } = input;

  // Server recomputes hash — never trust client-supplied hash
  const serverComputedHash = createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  // 1. Check contentHash — same file content → warning (suggest review, don't block)
  const existingByHash = await prisma.document.findFirst({
    where: { contentHash: serverComputedHash, projectId },
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
