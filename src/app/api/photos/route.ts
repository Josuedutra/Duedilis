/**
 * POST /api/photos — upload photo metadata (after R2 presign upload)
 * GET  /api/photos?projectId=&orgId= — list photos by project
 *
 * Sprint D2, Task gov-1775041297153-uzp0s2
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { uploadPhoto, listPhotosByProject } from "@/lib/actions/photo-actions";

const UploadPhotoSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  folderId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
  fileHash: z.string().min(1),
  gpsMetadata: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      altitude: z.number().nullable(),
    })
    .nullable()
    .optional(),
  isMobile: z.boolean().optional(),
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

  const parsed = UploadPhotoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const photo = await uploadPhoto(parsed.data);
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    const status = message.includes("mimeType inválido") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const orgId = searchParams.get("orgId");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (!projectId || !orgId) {
    return NextResponse.json(
      { error: "projectId e orgId são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const photos = await listPhotosByProject({
      projectId,
      orgId,
      page,
      limit,
    });
    return NextResponse.json({ photos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
