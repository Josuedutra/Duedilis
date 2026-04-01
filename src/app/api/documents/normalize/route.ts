/**
 * POST /api/documents/normalize
 * Triggers ISO 19650 normalization for a document via Claude Haiku.
 *
 * Body: { documentId: string }
 * Flow: PENDING → NORMALIZING → READY (or PENDING on error)
 *
 * Task: gov-1775041253896-v20gul
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDocumentName } from "@/lib/services/iso-normalization";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let documentId: string;
  try {
    const body = await req.json();
    documentId = body.documentId;
    if (!documentId || typeof documentId !== "string") {
      return NextResponse.json(
        { error: "documentId é obrigatório." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Fetch the document
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { folder: true, project: true },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Documento não encontrado." },
      { status: 404 },
    );
  }

  if (doc.status !== "PENDING") {
    return NextResponse.json(
      {
        error: `Estado inválido: ${doc.status}. Apenas documentos PENDING podem ser normalizados.`,
      },
      { status: 409 },
    );
  }

  // Transition to NORMALIZING
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "NORMALIZING" },
  });

  try {
    // Build folder path from document storage key or folder name
    const folderPath = doc.folder?.name ?? doc.folderId;
    const projectCode =
      doc.project?.name?.substring(0, 8).toUpperCase() ?? "PRJ";

    const result = await normalizeDocumentName({
      originalName: doc.originalName,
      projectCode,
      folderPath,
    });

    // Update document with normalization results → READY
    await prisma.document.update({
      where: { id: documentId },
      data: {
        isoName: result.isoName,
        discipline: result.discipline,
        docType: result.docType,
        revision: result.revision,
        status: "READY",
      },
    });

    return NextResponse.json({
      documentId,
      status: "READY",
      isoName: result.isoName,
      discipline: result.discipline,
      docType: result.docType,
      revision: result.revision,
      confidence: result.confidence,
    });
  } catch (err) {
    // Revert to PENDING on error
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PENDING" },
    });

    console.error("[iso-normalization] error:", err);
    return NextResponse.json(
      { error: "Falha na normalização IA. Tente novamente." },
      { status: 500 },
    );
  }
}
