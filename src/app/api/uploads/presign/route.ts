/**
 * POST /api/uploads/presign
 * Generate a presigned R2 URL for direct client upload.
 *
 * Input: { orgId, projectId, folderId, fileName, fileSizeBytes, mimeType, fileHash }
 * Output: { uploadUrl, storageKey, expiresAt }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { presignUpload } from "@/lib/actions/upload-actions";
import { z } from "zod";

const PresignSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  folderId: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(104857600), // 100MB
  mimeType: z.string().min(1),
  fileHash: z.string().optional(),
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

  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await presignUpload(parsed.data);
    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      storageKey: result.key,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("400") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
