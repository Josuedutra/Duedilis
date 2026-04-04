/**
 * PATCH /api/cde/staging/[stagingId]
 * Perform a lifecycle transition on a staging document.
 *
 * Body: { action: "validate" | "promote" | "reject"; reason?: string }
 *
 * Task: gov-1775322197923-oc65nv (D4-06v2)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateStaging,
  promoteStaging,
  rejectStaging,
} from "@/lib/cde/staging";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { stagingId: string } },
) {
  const { stagingId } = params;

  let body: { action?: string; reason?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { action, reason } = body;

  if (!action) {
    return NextResponse.json(
      { error: "Campo obrigatório: action (validate | promote | reject)." },
      { status: 400 },
    );
  }

  try {
    if (action === "validate") {
      const result = await validateStaging({ stagingId });
      return NextResponse.json(result);
    }

    if (action === "promote") {
      const result = await promoteStaging({ stagingId });
      return NextResponse.json(result);
    }

    if (action === "reject") {
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: "O motivo de rejeição é obrigatório." },
          { status: 400 },
        );
      }
      const result = await rejectStaging({ stagingId, reason });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        error: `Acção desconhecida: ${action}. Use validate, promote ou reject.`,
      },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";

    if (message.includes("não encontrado")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("inválida") || message.includes("obrigatório")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
