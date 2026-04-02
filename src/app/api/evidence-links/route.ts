import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createEvidenceLink,
  listEvidenceLinks,
} from "@/lib/actions/evidence-link-actions";

/**
 * GET /api/evidence-links?entityType=&entityId=&orgId=
 * Lista links para uma entidade (bidirecional — source OU target)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as
    | "Issue"
    | "Document"
    | "Photo"
    | "Meeting"
    | null;
  const entityId = searchParams.get("entityId");
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    // Se entityType + entityId fornecidos: filtra bidirecional
    if (entityType && entityId) {
      const [asSource, asTarget] = await Promise.all([
        listEvidenceLinks({
          orgId,
          sourceType: entityType,
          sourceId: entityId,
        }),
        listEvidenceLinks({
          orgId,
          targetType: entityType,
          targetId: entityId,
        }),
      ]);

      // Deduplicar por id
      const seen = new Set<string>();
      const links = [...asSource, ...asTarget].filter((l: { id: string }) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });

      return NextResponse.json({ links });
    }

    // Sem filtro de entidade: lista todos da org (sem filter)
    const links = await listEvidenceLinks({ orgId });
    return NextResponse.json({ links });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/evidence-links
 * Cria um novo link probatório entre duas entidades
 * Requer role >= FISCAL na org
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    orgId,
    projectId,
    sourceType,
    sourceId,
    targetType,
    targetId,
    description,
  } = body;

  if (
    !orgId ||
    !projectId ||
    !sourceType ||
    !sourceId ||
    !targetType ||
    !targetId
  ) {
    return NextResponse.json(
      {
        error:
          "orgId, projectId, sourceType, sourceId, targetType and targetId are required",
      },
      { status: 400 },
    );
  }

  try {
    const link = await createEvidenceLink({
      orgId,
      projectId,
      sourceType,
      sourceId,
      targetType,
      targetId,
      description,
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
