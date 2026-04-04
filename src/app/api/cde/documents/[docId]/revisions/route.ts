/**
 * GET  /api/cde/documents/[docId]/revisions — list revision history
 * POST /api/cde/documents/[docId]/revisions — create new revision
 *
 * Task: gov-1775322171829-s50bch (D4-03v2)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createDocumentRevision,
  getRevisionHistory,
} from "@/lib/cde/revisions";

export async function GET(
  _req: NextRequest,
  { params }: { params: { docId: string } },
) {
  try {
    const revisions = await getRevisionHistory({ documentId: params.docId });
    return NextResponse.json(revisions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    if (message.includes("Não autenticado")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let body: {
    revisionCode?: string;
    storageKey?: string;
    fileBuffer?: number[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.revisionCode || typeof body.revisionCode !== "string") {
    return NextResponse.json(
      { error: "revisionCode é obrigatório." },
      { status: 400 },
    );
  }
  if (!body.storageKey || typeof body.storageKey !== "string") {
    return NextResponse.json(
      { error: "storageKey é obrigatório." },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.fileBuffer)) {
    return NextResponse.json(
      { error: "fileBuffer é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const revision = await createDocumentRevision({
      documentId: params.docId,
      revisionCode: body.revisionCode,
      fileBuffer: Buffer.from(body.fileBuffer),
      storageKey: body.storageKey,
    });
    return NextResponse.json(revision, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    if (message.includes("Não autenticado")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
