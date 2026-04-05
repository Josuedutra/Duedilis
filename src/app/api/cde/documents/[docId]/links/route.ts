/**
 * GET  /api/cde/documents/[docId]/links — list bidirectional links for a document
 * POST /api/cde/documents/[docId]/links — create a new document link
 *
 * Task: gov-1775322207963-6bjant (D4-07v2)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listDocumentLinks,
  createDocumentLink,
} from "@/lib/cde/document-links";
import type { CreateDocumentLinkInput } from "@/lib/cde/document-links";

export async function GET(
  req: NextRequest,
  { params: _params }: { params: Promise<{ docId: string }> },
) {
  const params = await _params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json(
      { error: "orgId é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const links = await listDocumentLinks({ orgId, docId: params.docId });
    return NextResponse.json(links);
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
  { params: _params }: { params: Promise<{ docId: string }> },
) {
  const params = await _params;
  let body: Partial<CreateDocumentLinkInput>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { orgId, projectId, targetType, targetId, linkType } = body;

  if (!orgId || !projectId || !targetType || !targetId || !linkType) {
    return NextResponse.json(
      {
        error:
          "Campos obrigatórios: orgId, projectId, targetType, targetId, linkType.",
      },
      { status: 400 },
    );
  }

  const VALID_LINK_TYPES = [
    "REFERENCE",
    "ATTACHMENT",
    "EVIDENCE",
    "SUPERSEDES",
    "RESPONDS_TO",
  ];

  if (!VALID_LINK_TYPES.includes(linkType)) {
    return NextResponse.json(
      {
        error: `linkType inválido. Valores aceites: ${VALID_LINK_TYPES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  try {
    const link = await createDocumentLink({
      orgId,
      projectId,
      sourceType: body.sourceType ?? "Document",
      sourceId: body.sourceId ?? params.docId,
      targetType,
      targetId,
      linkType,
      isEvidence: body.isEvidence ?? linkType === "EVIDENCE",
    });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    if (message.includes("409") || message.includes("já existe")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("Não autenticado")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
