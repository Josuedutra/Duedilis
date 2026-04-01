/**
 * POST /api/uploads/batch
 * Create a batch of uploads OR confirm a completed batch.
 *
 * Create batch:
 *   Input:  { orgId, projectId, folderId, files: [{name, size, mime, hash}] }
 *   Output: { batchId, presignedUrls: string[] }
 *
 * Confirm batch:
 *   Input:  { batchId }
 *   Output: { batch: { id, status } }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUploadBatch, confirmBatch } from "@/lib/actions/upload-actions";
import { z } from "zod";

const CreateBatchSchema = z.object({
  action: z.literal("create").optional(),
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  folderId: z.string().min(1),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        fileSizeBytes: z.number().int().positive(),
        fileHash: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

const ConfirmBatchSchema = z.object({
  action: z.literal("confirm"),
  batchId: z.string().min(1),
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

  // Check if it's a confirm request
  const bodyObj = body as Record<string, unknown>;
  if (
    bodyObj?.action === "confirm" ||
    ("batchId" in bodyObj && !("files" in bodyObj))
  ) {
    const parsed = ConfirmBatchSchema.safeParse(
      bodyObj.action === "confirm" ? body : { action: "confirm", ...bodyObj },
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    try {
      const result = await confirmBatch({ batchId: parsed.data.batchId });
      return NextResponse.json({ batch: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      const status =
        message.includes("400") || message.includes("estado") ? 400 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  // Otherwise create batch
  const parsed = CreateBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createUploadBatch(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status =
      message.includes("400") ||
      message.includes("limite") ||
      message.includes("tamanho")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
