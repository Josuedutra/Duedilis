/**
 * POST /api/cde/documents/[docId]/revisions/[revId]/stamps — create validation stamp
 *
 * Task: gov-1775322171829-s50bch (D4-03v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { createValidationStamp } from "@/lib/cde/stamps";

export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ docId: string; revId: string }> },
) {
  const params = await _params;
  let body: { payload?: Record<string, unknown> };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json(
      { error: "payload é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const stamp = await createValidationStamp({
      documentId: params.docId,
      revisionId: params.revId,
      payload: body.payload,
    });
    return NextResponse.json(stamp, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    if (message.includes("Não autenticado")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
