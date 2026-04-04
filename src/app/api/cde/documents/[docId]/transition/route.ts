/**
 * POST /api/cde/documents/[docId]/transition
 * Transition a CDE document through its lifecycle state machine.
 *
 * Body: { toStatus: string; reason: string }
 * State machine: WIP → SHARED → PUBLISHED → SUPERSEDED → ARCHIVED
 *                Any (except ARCHIVED) → ARCHIVED
 *
 * Task: gov-1775322165820-2ufgff (D4-02v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { transitionCdeDocLifecycle } from "@/lib/cde/lifecycle";

export async function POST(
  req: NextRequest,
  { params }: { params: { docId: string } },
) {
  let toStatus: string;
  let reason: string;

  try {
    const body = await req.json();
    toStatus = body.toStatus;
    reason = body.reason;

    if (!toStatus || typeof toStatus !== "string") {
      return NextResponse.json(
        { error: "toStatus é obrigatório." },
        { status: 400 },
      );
    }
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json(
        { error: "reason é obrigatório." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const result = await transitionCdeDocLifecycle({
      documentId: params.docId,
      toStatus,
      reason,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";

    if (
      message.includes("Não autenticado") ||
      message.includes("autenticado")
    ) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (
      message.includes("não encontrado") ||
      message.includes("não encontrado")
    ) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("inválida") || message.includes("não permitida")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
