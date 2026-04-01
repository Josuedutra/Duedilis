/**
 * POST /api/uploads/confirm
 * Confirm an upload: verify hash and create/update Document.
 *
 * Input: { storageKey, fileHash }
 * Output: { document: { id, status } }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEntry } from "@/lib/services/audit-log";
import { z } from "zod";

const ConfirmSchema = z.object({
  storageKey: z.string().min(1),
  fileHash: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { storageKey, fileHash } = parsed.data;

  // Find document by storageKey
  const doc = await prisma.document.findFirst({
    where: { storageKey },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Document not found for storageKey" },
      { status: 404 },
    );
  }

  // Verify hash
  if (doc.fileHash !== fileHash) {
    return NextResponse.json(
      {
        error: `Hash mismatch: expected ${doc.fileHash}, received ${fileHash}`,
      },
      { status: 400 },
    );
  }

  // Transition to PENDING (upload confirmed, awaiting normalization)
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { status: "PENDING" },
  });

  await createAuditEntry({
    orgId: doc.orgId,
    entityType: "Document",
    entityId: doc.id,
    action: "UPDATE",
    userId: session.user.id,
    payload: { event: "upload_confirmed", storageKey, status: "PENDING" },
  });

  return NextResponse.json({
    document: { id: updated.id, status: updated.status },
  });
}
