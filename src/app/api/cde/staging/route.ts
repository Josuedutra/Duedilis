/**
 * GET  /api/cde/staging — list staging documents for a project
 * POST /api/cde/staging — create a new staging document
 *
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStagingDocument } from "@/lib/cde/staging";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const orgId = searchParams.get("orgId");

  if (!projectId || !orgId) {
    return NextResponse.json(
      { error: "projectId e orgId são obrigatórios." },
      { status: 400 },
    );
  }

  try {
    const docs = await prisma.stagingDocument.findMany({
      where: { projectId, orgId },
      orderBy: { uploadedAt: "desc" },
    });
    return NextResponse.json({ data: docs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    originalName?: string;
    orgId?: string;
    projectId?: string;
    folderId?: string;
    uploadedById?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { originalName, orgId, projectId, folderId, uploadedById } = body;

  if (!originalName || !orgId || !projectId || !folderId || !uploadedById) {
    return NextResponse.json(
      {
        error:
          "Campos obrigatórios: originalName, orgId, projectId, folderId, uploadedById.",
      },
      { status: 400 },
    );
  }

  try {
    const doc = await createStagingDocument({
      originalName,
      orgId,
      projectId,
      folderId,
      uploadedById,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
